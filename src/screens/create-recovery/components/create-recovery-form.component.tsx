import { forwardRef, useContext, useEffect, useState } from "react";
import {
  Container,
  Group,
  Stack,
  Select,
  Button,
  Text,
  Textarea,
  TextInput,
  Paper,
  Avatar,
  Alert,
  Switch,
  Box,
  Modal,
  Loader,
  Center,
} from "@mantine/core";
import { IconAlertCircle, IconMoneybag } from "@tabler/icons";
import useRecoveryStore from "store/recovery/recovery.store";
import { useStyles } from "./create-recovery.component.styles";
import { BackButton, ProgressStatus, Title, Image } from "../../../components";
import { useNavigate } from "react-router-dom";
import {  } from "services";

//@ts-ignore
import Safe from "../../../assets/icons/safe-zen.svg";
import { ethers } from "ethers";
import EthersAdapter from "@safe-global/safe-ethers-lib";
import { PredictSafeProps, SafeAccountConfig, SafeDeploymentConfig, SafeFactory } from "@safe-global/safe-core-sdk";
import SafeServiceClient from "@safe-global/safe-service-client";
import { Contract } from "ethers";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import { RoutePath } from "navigation";
import { NetworkUtil } from "utils/networks";


const progressMessage = [{text: "Setting up a new wallet. Powered by Safe ⛓🔒", image: Safe}, {text: "Setting up a new wallet. Powered by Safe ⛓🔒", image: Safe}]

export const CreateRecoveryForm = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();


  const [walletName, setWalletName] = useState("");
  const [walletDescription, setWalletDescription] = useState("");

  const [progressStage, setProgressStage] = useState(0);


  const [isBeneficiary, setIsBeneficiary] = useState(false);
  const [walletBeneficiary, setWalletBeneficiary]: any = useState('');


  const [errorMessage, setErrorMessage] = useState("");
  const [validator, setValidator] = useState(false);
  const [creating, setCreating] = useState(false);

  const [advancedOptions, setAdvancedOptions] = useState(false);

  const { setCreateStep, chainId, accountDetails, setSafeId, setSafeStatus } = useRecoveryStore(
    (state: any) => state
  );

  
  useEffect(() => {

    ;(async () => {

      // Create a wallet if no safes found 
      if(!accountDetails.authResponse.safes.length)
      await createSafe();    
  })()
   
  }, [])
  
  
  const createSafe = async () => {
  
    setCreating(true);
    setSafeStatus(false);
    
    const provider = new ethers.providers.JsonRpcProvider(NetworkUtil.getNetworkById(chainId)!.url)
    const safeDeployer = new ethers.Wallet(process.env.REACT_APP_GUARDIAN_WALLET_KEY!, provider)
    const ethAdapter = new EthersAdapter({
      ethers,
      signerOrProvider:safeDeployer
    })

    const safeFactory = await SafeFactory.create({ ethAdapter })
    const saltNonce = (new Date().getTime() / 1000).toFixed();
    const safeDeploymentConfig: SafeDeploymentConfig = {
      saltNonce: saltNonce.toString()
      // ... (optional params)
    }
    const safeAccountConfig: SafeAccountConfig = {
      owners: [accountDetails.authResponse.eoa!],
      threshold: 1,
      // ... (optional params)
    }

    const predectedWalletAddress = await safeFactory.predictSafeAddress({ safeAccountConfig, safeDeploymentConfig })
    
    setSafeId(predectedWalletAddress)



    
    

    try {

    const gasPrice = await safeDeployer.getGasPrice();  
    const safeSdk =  safeFactory.deploySafe({ safeAccountConfig, safeDeploymentConfig, options: chainId == '137' ? {gasPrice : parseInt(gasPrice.toString()) + 20000000000} : {}})
    
    setCreating(false);

    const eoa = accountDetails.authResponse.eoa;  
    let defaultWallet: any =  localStorage.getItem("defaultWallet") ? JSON.parse(localStorage.getItem("defaultWallet")!) : {};
    defaultWallet[eoa][chainId] = { address: predectedWalletAddress, deployed: false };
    localStorage.setItem("defaultWallet", JSON.stringify(defaultWallet))

    safeSdk.then((response)=> { 

      console.log(response)
      
      defaultWallet[eoa][chainId] = { address: predectedWalletAddress, deployed: true };
  
      localStorage.setItem("defaultWallet", JSON.stringify(defaultWallet))
      
      setSafeStatus(true); })

    }
    catch(e) {
      console.log(e)
    }  

    navigate(RoutePath.wallet)
  
  }



  const backButtonHandler = () => {
    setCreateStep(1);
  };

  return (
    <Container className={classes.box}>
            <Modal
        centered
        opened={creating}
        onClose={() => !creating}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        withCloseButton={false}
        // overlayOpacity={0.5}
        size={320}
      >
        <Box sx={{ padding: "20px" }}>
          <Group>
            <Container
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <Loader />
              
              <Text mt={"lg"} align='center'>{progressMessage[progressStage].text}
              <Box sx={{ paddingTop: "20px" }}><Center><Image src={progressMessage[progressStage].image} width={150}/></Center> </Box>
              </Text>
              
            </Container>
          </Group>
        </Box>
      </Modal>
      <Paper className={classes.formContainer} withBorder>
        <BackButton label="Back to Previous" onClick={backButtonHandler} />
        <Group mb={30}>
          <Title>Create a Wallet</Title>
        </Group>
        <Stack justify="flex-start">
          <TextInput
            type="text"
            placeholder="Enter Wallet Name"
            label="Wallet Name (Optional)"
            rightSectionWidth={92}
            onChange={(event) => {
              setWalletName(event.target.value);
            }}
          />

          <Textarea
            placeholder="Wallet Description"
            label="Wallet Description (Optional)"
            rightSectionWidth={92}
            onChange={(event) => {
              setWalletDescription(event.target.value);
            }}
          />

          <Group sx={{ justifyContent: "space-between" }}>
            <Text size="md" weight={600}>
              Advanced options
            </Text>{" "}
            <Switch
              checked={isBeneficiary}
              onChange={() => setIsBeneficiary(!isBeneficiary)}
            />
          </Group> 
          { isBeneficiary && <TextInput
            type="email"
            placeholder="Enter Beneficiary email or DID"
            label="Beneficiary Email or DID (Optional)"
            rightSectionWidth={92}
            onChange={(event) => {
              setWalletBeneficiary(event.target.value);
            }}
          />
          }

      <Alert icon={<IconMoneybag size={32} />} title="Gasless smart contract wallet!" color="grape" radius="lg">
           Smart contract wallet will be deployed gasless on Base Goerli chain
        </Alert>  
         

          <Button
            loading={creating}
            className={classes.button}
            onClick={() => {
              createSafe();
            }}
            style={{
              background:
                "linear-gradient(132.56deg, #61FF47 -20.89%, #89B8FF 99.53%, #FF70F1 123.47%)",
            }}
          >
            Create
          </Button>
        </Stack>
      </Paper>

      <Container className={classes.progressbox}>
        <ProgressStatus
          title="Creating a wallet via Safe"
          description="Provide the basic details for the wallet. You can even create a multisig wallet with multiple signer ✍️."
          // update the status according to the progress
          status={creating ? 100 : 50}
        />
      </Container>
    </Container>
  );
};
