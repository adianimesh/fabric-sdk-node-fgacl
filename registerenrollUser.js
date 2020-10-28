const yaml = require('js-yaml');
const FabricCAServices = require('fabric-ca-client');
const {FileSystemWallet, Gateway, X509WalletMixin} = require('fabric-network');
const fs = require('fs');
const path = require('path');
const caName = "5f93f821-0956-40a0-8c8f-d75d3f01caa0-ca";
const network = yaml.safeLoad(fs.readFileSync('../network.yaml', 'utf8'));

async function enrollAndRegister(newUser, newUserPassword) {
    const adminUser = network.certificateAuthorities[caName].registrar[0].enrollId;
    const adminPassword = network.certificateAuthorities[caName].registrar[0].enrollSecret;
    console.log('Admin User:', adminUser);
    console.log('Admin Password:', adminPassword);
    console.log('New User:', newUser);
    console.log('New Password:', newUserPassword);

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log('Wallet path:', walletPath);

    try {

        // Create a new CA client for interacting with the CA.
        const caURL = network.certificateAuthorities[caName].url;
        const ca = new FabricCAServices(caURL);

        // Check to see if we've already enrolled the admin user.
        const adminEnrolled = await wallet.exists(adminUser);
        if (adminEnrolled) {
            console.log('An identity for the admin user ' + adminUser + ' already exists in the wallet');
            // return;
        } else {

            // Enroll the admin user, and import the new identity into the wallet.
            const adminEnrollment = await ca.enroll({enrollmentID: adminUser, enrollmentSecret: adminPassword});
            const identity = X509WalletMixin.createIdentity(network.name, adminEnrollment.certificate, adminEnrollment.key.toBytes());
            await wallet.import(adminUser, identity);
            console.log('Successfully enrolled admin user ' + adminUser + ' and imported it into the wallet');
        }
        console.log('************************ Admin User is Enrolled as Registrar *************************** ');
    } catch (error) {
        console.error('Failed to enroll Admin user ' + adminUser + ':', error);
        process.exit(1);
    }

    try {
        const userExists = await wallet.exists(newUser);
        if (userExists) {
            console.log('An identity for the user ' +  newUser + ' already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists(adminUser);
        if (!adminExists) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            // console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(network, {wallet, identity: adminUser, discovery: {enabled: false}});

        // Get the CA client object from the gateway for interacting with the CA.
        const caRegisterEnroll = gateway.getClient().getCertificateAuthority();
        // console.log('caRegisterEnroll:', caRegisterEnroll);
        const adminIdentity = gateway.getCurrentIdentity();
        // console.log('adminIdentity:', adminIdentity);

        const userAttributes = [
            {ecert:true, name:'hf.Registrar.Roles', value:'*'},
            {ecert:true, name:'hf.Revoker', value:'true'},
            {ecert:true, name:'hf.Registrar.DelegateRoles', value:'*'},
            {ecert:true, name:'hf.Registrar.Attributes', value:'*'},
            {ecert:true, name:'hf.GenCRL', value:'true'},
            {ecert:true, name:'hf.IntermediateCA', value:'true'},
            {ecert:true, name:'hf.AffiliationMgr', value:'true'},
            {ecert:true, name:'transferRedMarbles', value:'true'},
            {ecert:true, name:'transferBlueMarbles', value:'true'},
            {ecert:true, name:'canDeleteMarble', value:'true'}
        ];

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await caRegisterEnroll.register({affiliation: network.name, enrollmentID: newUser, role: 'client', attrs: userAttributes}, adminIdentity);
        console.log('Secret Returned:', secret);
        const enrollment = await caRegisterEnroll.enroll({enrollmentID: newUser, enrollmentSecret: newUserPassword});
        const userIdentity = X509WalletMixin.createIdentity(network.name, enrollment.certificate, enrollment.key.toBytes());
        await wallet.import(newUser, userIdentity);
        console.log('Successfully registered and enrolled New User ' + newUser + ' and imported it into the wallet. . .');

    } catch (error) {
        console.error('Failed to Register New User ' + newUser + ' :', error);
        process.exit(1);
    }
}

async function main() {
    let myArgs = process.argv.slice(2);
    if (myArgs.length != 2) {
        console.log('Incorrect number of arguments. Expecting 2');
        return;
    }
    console.log('myArgs: ', myArgs);
    await enrollAndRegister(myArgs[0], myArgs[1]);
}

main()