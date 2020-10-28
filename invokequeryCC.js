const yaml = require('js-yaml');
const { FileSystemWallet, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const ccpPath = yaml.safeLoad(fs.readFileSync('../network.yaml', 'utf8'));

async function doQueryInvoke(user, password, channel, chaincode, functionName, funcArgs) {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(user);
        if (!userExists) {
            console.log('An identity for the user %s does not exist in the wallet', user);
            console.log('Run registerenrollUser.js script before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: user, discovery: { enabled: false, asLocalhost: false } });
        console.log('Connected to peer node');
        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork(channel);
        console.log('Got access to channel %s', channel);
        // Get the contract from the network.
        const contract = network.getContract(chaincode);
        console.log('Got access to contract %s', chaincode);

        switch (functionName) {
            case 'ACLInitialization':
                let responseAclInit = await contract.submitTransaction("ACLInitialization");
                console.log('ACLInitialization ' + JSON.stringify(responseAclInit));
                break;
            case 'createFineGrainedAclSampleResources':
                let responseCreateSampleResources = await contract.submitTransaction("createFineGrainedAclSampleResources");
                console.log('createFineGrainedAclSampleResources ' + JSON.stringify(responseCreateSampleResources));
                break;
            case 'createTestMarbles':
                let responseCreateTestMarbles = await contract.submitTransaction("createTestMarbles");
                console.log('createTestMarbles ' + JSON.stringify(responseCreateTestMarbles));
                break;
            case 'transferMarble':
                if (funcArgs.length != 2) {
                    throw new Error('Incorrect number of arguments for transferMarble. Specify color and owner in order after transferMarble');
                }
                let responseTransferMarble = await contract.submitTransaction("transferMarble", funcArgs[0], funcArgs[1]);
                console.log('transferMarble ' + JSON.stringify(responseTransferMarble));
                break;
            case 'transferMarblesBasedOnColor':
                if (funcArgs.length != 2) {
                    throw new Error('Incorrect number of arguments for transferMarblesBasedOnColor. Specify color and owner in order after MarblesBasedOnColor');
                }
                let responseTransferMarblesBasedOnColor = await contract.submitTransaction("transferMarblesBasedOnColor",funcArgs[0], funcArgs[1]);
                console.log('transferMarblesBasedOnColor ' + JSON.stringify(responseTransferMarblesBasedOnColor));
                break;
            case 'delete':
                if (funcArgs.length != 1) {
                    throw new Error('Incorrect number of arguments for delete. Specify color after delete');
                }
                let responseDelete = await contract.submitTransaction("delete",funcArgs[0]);
                console.log('delete ' + JSON.stringify(responseDelete));
                break;
            default:
                console.log('Sorry, that is not something I know how to do.');
        }

        console.log('Transaction has been submitted');
        // Disconnect from the gateway.
        await gateway.disconnect();
        console.log('Disconnected from peer node');
    } catch (error) {
        console.log(`Failed to submit transaction: ${error}`);
        process.exit(1);
    }
}

async function main() {
    let myArgs = process.argv.slice(2);
    if (myArgs.length < 5) {
        throw new Error('Incorrect number of arguments. Expecting a minimum of 5');
    }
    let user = myArgs[0];
    let password = myArgs[1];
    let channel = myArgs[2];
    let chaincode = myArgs[3];
    let functionName = myArgs[4];
    let funcArgs = myArgs.slice(4);
    console.log("user %s, password %s, channel %s, chaincode %s, functionName %s, functionArguments", user, password, channel, chaincode, functionName, funcArgs);
    await doQueryInvoke(user, password, channel, chaincode, functionName, funcArgs);
}

main();
