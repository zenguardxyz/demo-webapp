import {
  Accordion,
  Alert,
  Box,
  Button,
  Center,
  Container,
  createStyles,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput, 
  SegmentedControl,
  Avatar,
  Timeline,
  Notification,
  Switch,
  useMantineTheme
} from "@mantine/core";

import { IconHammer, IconFingerprint, IconMail, IconDatabase, IconScan, IconGitBranch, IconX, IconPlugConnected, IconAlertCircle } from '@tabler/icons';

// import Safe, { SafeFactory } from "@safe-global/safe-core-sdk";
import Safe, { getSafeContract, EthersAdapter, SafeFactory } from '@safe-global/protocol-kit';
import { MetaTransactionData, OperationType, SafeTransactionDataPartial, RelayTransaction, MetaTransactionOptions } from "@safe-global/safe-core-sdk-types";
import { GelatoRelayPack } from '@safe-global/relay-kit'
// import EthersAdapter from "@safe-global/safe-ethers-lib";
import SafeApiKit from "@safe-global/api-kit";
import { BackButton, EmptyState, Image } from "components";
import { Contract, ethers } from "ethers";
import { forwardRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import useRecoveryStore from "store/recovery/recovery.store";
import crypto from 'crypto';
//@ts-ignore
import SafeIcon from "../../assets/icons/safe.png";
//@ts-ignore
import Base from "../../assets/icons/base.png";
//@ts-ignore
import ETH from "../../assets/icons/eth.svg";
//@ts-ignore
import Gnosis from "../../assets/icons/gno.svg";
//@ts-ignore
import Polygon from "../../assets/icons/matic.svg";


import recoveryModule from "../../artifacts/SocialRecoveryModule.json";
//@ts-ignore
import ZenGuard from "../../assets/icons/recovery.svg";
import { IconCheck } from "@tabler/icons";
import { client, server } from "@passwordless-id/webauthn";
import { register } from "@passwordless-id/webauthn/dist/esm/client";
import { TimeUtil } from "utils/time";
import { RoutePath } from "navigation";
import { NetworkUtil } from "utils/networks";
import { signClient } from "utils/walletConnect";
import { createModuleEnableTransaction } from "utils/safe";
import { createContractTransaction, relayTransaction, waitForRelayTransaction } from "utils/gelato"; 

const oauthGuardian = '0x14E900767Eca41A42424F2E20e52B20c61f9E3eA';
const recoveryAPI = process.env.REACT_APP_RECOVERY_API;

const useStyles = createStyles((theme) => ({
  settingsContainer: {
    borderRadius: "8px",
    width: "591px",
    margin: "45px auto 0 auto",
    minWidth: "591px",
    [`@media (max-width: ${theme.breakpoints.sm}px)`]: {
      maxWidth: "100%",
      minWidth: "100%",
    },
  },

  formContainer: {
    marginBottom: "40px",
    [`@media (max-width: ${theme.breakpoints.sm}px)`]: {
      padding: "30px 20px",
    },
  },
}));

export const WalletSettings = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const theme = useMantineTheme();

  const { accountDetails, safeId, setSafeId, chainId, setChainId, proposalParams, setProposalParams, setConfirming, setConfirmed  } = useRecoveryStore(
    (state: any) => state,
  );


  const [signalingPeriod, setSignalingPeriod] = useState(30);
  const [walletBeneficiary, setWalletBeneficiary]: any = useState('');
  const [wcURI, setWcURI]: any = useState('');
  const [webAuthnData, setWebAuthnData] = useState({});
  const [recoveryType, setRecoveryType]: any = useState('email');
  const [claimType, setClaimType]: any = useState();
  const [creating, setCreating] = useState(false);
  const [ guard, setGuard ] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [executedHash, setExecutedHash] = useState("");
  

  useEffect(() => {

    

    ;(async () => {

      try {

        const safeOwner = new ethers.providers.Web3Provider(accountDetails.provider as ethers.providers.ExternalProvider).getSigner(0)
        const ethAdapter = new EthersAdapter({
          ethers,
          signerOrProvider:safeOwner
        })



        const safeInstance: Safe = await Safe.create({ ethAdapter, safeAddress: safeId })

        const modules = await safeInstance.getModules()

        if(modules.length) { 

          setRecovery(true);

        }

    
      }
      catch(e) {

      }

  
    })()
  }, [])


  const pairClient = async () => {

    console.log(signClient)
    await signClient.core.pairing.pair({ uri: wcURI });

  }


  const approveConnection = async () => {

  const { topic, acknowledged } = await signClient.approve({
    id: proposalParams.id,
    namespaces: {
      eip155: {
        accounts: proposalParams.requiredNamespaces.eip155.chains.map((chain: string) => `${chain}:${safeId}`),
        methods: proposalParams.requiredNamespaces.eip155.methods,
        events: proposalParams.requiredNamespaces.eip155.events,
      },
    },
  });
  setProposalParams({});
}

  const registerBiometric = async () => {

  try {  
  setRegistering(true); 
  setRegistrationSuccess(false); 
  const challenge = "a7c61ef9-dc23-4806-b486-2428938a547e"
  const registration = await client.register("ZenGuard Recovery", challenge, {
  "authenticatorType": "auto",
  "userVerification": "required",
  "timeout": 60000,
  "attestation": false,
  "debug": false
})

setRegistering(false); 
setRegistrationSuccess(true);

setWebAuthnData(registration);
  }
  catch(e) {

    setRegistering(false); 

  }



  }

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  const createRecovery = async () => {

    const recoveryEmailHash = crypto.createHash('sha256').update(walletBeneficiary).digest('hex');
    setCreating(true);

    while(!JSON.parse(localStorage.getItem("defaultWallet")!)[accountDetails.authResponse.eoa][chainId].deployed) {
      await TimeUtil.sleep(1000);
    }

    try {
    const recoveryResponse = await axios.post(`${recoveryAPI}/recovery`, {
      type: 'email',
      recoveryEmailHash: recoveryEmailHash,
      webAuthnData: webAuthnData,
      safeAddress: safeId,
      chainId: chainId
    })
    
    const recModule = recoveryResponse.data.data.recoveryModuleAddress;
    
    
    const safeOwner = new ethers.providers.Web3Provider(accountDetails.provider as ethers.providers.ExternalProvider).getSigner(0)
    const ethAdapter = new EthersAdapter({
      ethers,
      signerOrProvider:safeOwner
    })



    const safeInstance: Safe = await Safe.create({ ethAdapter, safeAddress: safeId })

    let signedSafeTx = await createModuleEnableTransaction(safeInstance, recModule )

    setCreating(false);
    setConfirming(true);
    setConfirmed(false);


    let response = await relayTransaction(signedSafeTx, chainId, safeInstance, safeId)

    await waitForRelayTransaction(response.taskId, chainId)


    signedSafeTx = await createContractTransaction(safeInstance, recModule, recoveryModule.abi, safeOwner, 'addGuardianWithThreshold',  [safeId, oauthGuardian, 1])



    response = await relayTransaction(signedSafeTx, chainId, safeInstance, safeId)

    await waitForRelayTransaction(response.taskId, chainId)

    setConfirmed(true);
    setConfirming(false);
    await TimeUtil.sleep(2000)
    setConfirmed(false);
    setRecovery(true);
  }
  catch(e) {
    console.log(e)
    setCreating(false);

  }
  
  }



  interface ItemProps extends React.ComponentPropsWithoutRef<'div'> {
    image: string;
    label: string;
  }

  const SelectItem = forwardRef<HTMLDivElement, ItemProps>(
    ({ image, label, ...others }: ItemProps, ref) => (
      <div ref={ref} {...others}>
        <Group noWrap>
          <Avatar src={image} />
  
          <div>
            <Text size="sm">{label}</Text>
          </div>
        </Group>
      </div>
    )
  );


  return (
    <Paper withBorder className={classes.settingsContainer}>
      
      <Container className={classes.formContainer} p={40}>


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
              
              <Text mt={"lg"} align='center'> Enabling recovery on your wallet
              <Box sx={{ paddingTop: "20px" }}><Center><Image src={ZenGuard} width={150}/></Center> </Box>
              </Text>
              
            </Container>
          </Group>
        </Box>
      </Modal>  
      
        
     <Modal
        centered
        opened={proposalParams.id}
        onClose={() => { setProposalParams({})} }
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
              
              
              <Box sx={{ paddingTop: "20px" }}><Center><Image src={ZenGuard} width={150}/></Center> </Box>
              <Text mt={"lg"} align='center'> Connect ZenGuard Wallet to { proposalParams.proposer?.metadata?.name } ?
              </Text>
              
            </Container>
          </Group>
          <Group position="center">
        <Button variant="outline" color="red" onClick={()=>{}}>Reject</Button>
        <Button variant="outline" color="green" onClick={()=>{approveConnection()}}>Accept</Button>
      </Group>
        </Box>
      </Modal>
     
        <Box mt={20}>
          <>
            <BackButton label="Go Back" onClick={() => navigate(RoutePath.account)} />

            <Text align="center" weight={600} size="lg">
              Settings
            </Text>
          </>
        </Box>

        <Paper shadow="xl" withBorder radius="md" p="xl" style={{
                    marginTop: 30
                  }}>
        <Stack>

        <Text size="md" weight={600}>
              General settings ⚙️
        </Text>{" "}

          

          <Select
            label="Select Network"
            placeholder="Select Network"
            itemComponent={SelectItem}
            value={chainId.toString()}
            data={[
              {
                value: '100',
                label: "Gnosis Mainnet",
                image: Gnosis
              },
              {
                value: '137',
                label: "Polygon Mainnet",
                image: Polygon
              },
              {
                value: '84531',
                label: "Base Testnet",
                image: Base
              },
              {
                value: '5',
                label: "Ethereum Testnet",
                image: ETH
              },
            ]}
            onChange={(value) => { 
              
              localStorage.setItem("chainId", value!);
              setSafeId('') 
              setChainId(parseInt(value!))}}
          />

          <Select
                label="Change wallet account"
                placeholder="Select a Safe wallet"
                value={safeId}
                data={accountDetails.authResponse.safes.map((safe: any) =>
                   ({
                    // image: 
                    value: safe,
                    label: safe,
                    image: SafeIcon
                  }))
                  
                }  
                itemComponent={SelectItem} 
                
                onChange={(value) => {          
                  setSafeId(value) } }
              />


<Text size="sm" weight={600}>
              WalletConnect Settings ⚙️
        </Text>{" "}
       <Group >
         
        <TextInput
            placeholder="WalletConnect URI"
            // label="Wallet Connect URI"
            rightSectionWidth={92}
            onChange={(event) => {
              setWcURI(event.target.value);
            }}
          />


          <Button
                // loading={registering}
                onClick={() => {
                  pairClient();
                }}
                leftIcon={<IconPlugConnected />} 
                variant="default"
                color="dark"
              >
                Connect Now
              </Button>


              </Group>

              </Stack>


          </Paper>

        
          <Paper shadow="xl" withBorder radius="md" p="xl" style={{
                    marginTop: 30
                  }} >

          <Stack>
          <Group sx={{ justifyContent: "space-between" }}>
            <Text size="md" weight={600}>
              Recovery settings 🛡️
            </Text>{" "}

          </Group> 

          <SegmentedControl size="lg"
          value={recoveryType}
          onChange={(value)=>{setRecoveryType(value)}}
      data={[
        {
          value: 'email',
          label: (
            <Center>
              <IconMail size="1.5rem" />
              <Box ml={10}>Email</Box>
            </Center>
          ),
        },
        {
          value: 'biometric',
          label: (
            <Center>
              <IconFingerprint size="1.5rem" />
              <Box ml={10}>Biometric</Box>
            </Center>
          ),
        },
        {
          disabled: true,
          value: 'arbitration',
          label: (
            <Center>
              <IconHammer size="1.5rem" />
              <Box ml={10}>Arbitration</Box>
            </Center>
          ),
        },
      ]}
    />
         { recoveryType == 'email' && !recovery && <TextInput
            type="email"
            placeholder="Enter Beneficiary email"
            label="Beneficiary Email"
            rightSectionWidth={92}
            onChange={(event) => {
              setWalletBeneficiary(event.target.value);
            }}
          />

          }

{ recovery && <Alert icon={<IconCheck size="10rem" />}  title="Account recovery is set 🛡️" color="green" >
     Your wallet account is secured with the ZenGuard recovery.
    </Alert>  
  }

        { recoveryType == 'biometric' && !recovery && <>
        
        
        <Group sx={{ justifyContent: "space-between" }}>

            <Timeline active={registrationSuccess ? 1 : 0} bulletSize={30} lineWidth={3}>
            <Timeline.Item bullet={<IconScan size={20} />} title="Register your Biometric 🐾"   style={{
              paddingBottom: 30
            }}>
                <Text color="dimmed" size="sm"  style={{
              paddingTop: 20,  paddingBottom: 20  }}> Authenticate now with Touch ID or Face ID</Text>
            
                <Button
                // loading={registering}
                onClick={() => {
                  registerBiometric();
                }}
                leftIcon={<IconScan />} 
                variant="default"
                color="dark"
              >
                Register Now
              </Button>

              { registering && <Notification
                  loading
                  title="Registering your Touch ID/ Face ID"
                  withCloseButton={false}
                  style={{
                    marginTop: 30
                  }}
               >
              Authenticating Touch ID or Face ID with your device
               </Notification> }

               { registrationSuccess && <Notification
                  // loading
                  icon={<IconCheck size={20} />}
                  color="teal"
                  title="Registration Scuccessful"
                  withCloseButton={false}
                  style={{
                    marginTop: 30
                  }}
               >
              Successfully registered Face ID/ Touch ID using your device
               </Notification> }
              </Timeline.Item>

            <Timeline.Item bullet={<IconMail size={12} />} title="Email to identify recovery" style={{
              paddingBottom: 35 }}>
              
              <Text color="dimmed" size="sm"  style={{
              paddingTop: 20,  paddingBottom: 20  }}> Provide an email ID to idenity this recovery later</Text>
                
            <TextInput
              type="email"
              placeholder="Enter your email"
              // label="Email for recovery"
              rightSectionWidth={92}
              onChange={(event) => {
                setWalletBeneficiary(event.target.value);
              }}
              />

            </Timeline.Item>
          </Timeline>
          </Group>

             </>

          }

{ !recovery && <>
    <Switch
        checked={guard}
        onChange={(event) => setGuard(event.currentTarget.checked)}
        color="teal"
        size="md"
        label="Enable additional recovery guard"
        thumbIcon={
          guard ? (
            <IconCheck size="0.8rem" color={theme.colors.teal[theme.fn.primaryShade()]} stroke={3} />
          ) : (
            <IconX size="0.8rem" color={theme.colors.red[theme.fn.primaryShade()]} stroke={3} />
          )
        }
      /> 
      { guard && <>
              <Select
                label="Add additional recovery guard"
                placeholder="Select Recovery Type"
                // itemComponent={SelectItem}
                // value={chain}
                data={[
                  {
                    value: "0",
                    label: "Cooling period (You can revoke before the cooling period)",
                  },
                  {
                    value: "1",
                    label: "Arbitration (Arbitrators decide the recovery claim)",
                  },
                  {
                    value: "2",
                    label: "DDAY (Claim on exact date)",
                  },
                ]}
                onChange={(value) => setClaimType(parseInt(value!))}
              />

          <TextInput
            type="text"
            placeholder={signalingPeriod.toString()}
            label="Cooling period (Seconds)"
            rightSectionWidth={92}
            onChange={(event) => {
              setSignalingPeriod(parseInt(event.target.value));
            }}
          />
          </>
          }

      <Button
            loading={creating}
            disabled={recoveryType == 'biometric' && (!walletBeneficiary || !registrationSuccess) || recoveryType == 'email' && !walletBeneficiary  }
            onClick={() => {
              createRecovery();
            }}
            style={{
              background:
                "linear-gradient(132.56deg, #61FF47 -20.89%, #89B8FF 99.53%, #FF70F1 123.47%)",
            }}
          >
            Create Recovery
          </Button> 
         </>  
         }

          { executedHash && <Alert icon={<IconCheck size={32} />} title="Recovery created!" color="green" radius="lg">
            Recovery successfully created for the wallet. Verify <a href={`${NetworkUtil.getNetworkById(chainId)?.blockExplorer}/tx/${executedHash}`} target="_blank">here</a>
          </Alert> 
          }

        </Stack>
        </Paper>
      </Container>
    </Paper>
  );
};
