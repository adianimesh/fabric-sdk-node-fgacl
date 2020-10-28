/*
 *  Copyright (C) 2018 SafeNet. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const path = require('path');
const fs = require('fs-extra');
const util = require('util');

const Client = require('fabric-client');
const copService = require('fabric-ca-client/lib/FabricCAServices.js');
const User = require('fabric-client/lib/User.js');

const logger = require('fabric-client/lib/utils.js').getLogger('application_demo.js');

module.exports.KVS = '/tmp/hfc-kvs'
module.exports.storePathForOrg = function(org) {
    return module.exports.KVS
};

logger.info('sdk-node : test application_demo');
Client.setConfigSetting('request-timeout', 6000000);
var client = Client.loadFromConfig('../network.yaml');

testClient(client);
const tlsOptions = {
    trustedRoots: [],
    verify: false
};

function getMember(username, password, client) {
	logger.info('sdk-node : enter getMember');
	const caUrl = 'https://bus00glg.us.oracle.com:10002';
	const caName = 'instancejazzca';

	const cryptoSuite = Client.newCryptoSuite();
	if (client._stateStore) {
		cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: module.exports.storePathForOrg('instancejazz')}));
	}
	client.setCryptoSuite(cryptoSuite);

	return client.getUserContext(username, true)
		.then((user) => {
			return new Promise((resolve, reject) => {
				if (user && user.isEnrolled()) {
					logger.info('sdk-node : successfully loaded member from persistence');
					return resolve(user);
				}
				const member = new User(username);
				member.setCryptoSuite(cryptoSuite);
				// need to enroll it with CA server
				const cop = new copService(caUrl, tlsOptions, caName, cryptoSuite);
				return cop.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('sdk-node : Successfully enrolled user ' + username);
					return member.setEnrollment(enrollment.key, enrollment.certificate, 'instancejazz');
				}).then(() => {
					let skipPersistence = false;
					if (!client.getStateStore()) {
						skipPersistence = true;
					}
					return client.setUserContext(member, skipPersistence);
				}).then(() => {
					return resolve(member);
				}).catch((err) => {
					logger.info('sdk-node : failed to enroll and persist user. error: ' + err.stack ? err.stack : err);
				});
			});
		});
}

module.exports.setAdmin = function(client) {
    return getAdmin(client);
};

async function getAdmin(client) {
//function getAdmin(client) {
    logger.info('sdk-node : enter getAdmin');
    const certPath = './artifacts/crypto/peerOrganizations/instancejazz/admincert/';
    const keyPath = './artifacts/crypto/peerOrganizations/instancejazz/keystore/';
    const certPEM = readAllFiles(certPath)[0];
    const cryptoSuite = Client.newCryptoSuite();
    let keyPEM = null;
    cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({ path: '/tmp/hfc-test-kvs_peerOrg1' }));
    client.setCryptoSuite(cryptoSuite);
    keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    logger.info('sdk-node : getAdmin : done');
    return Promise.resolve(client.createUser({
        username: 'peerorg1Admin',
        mspid: 'instancejazz',
        cryptoContent: {
            privateKeyPEM: keyPEM.toString(),
            signedCertPEM: certPEM.toString()
        }
    }));
}

function readAllFiles(dir) {
    const files = fs.readdirSync(dir);
    const certs = [];
    files.forEach((file_name) => {
        const file_path = path.join(dir, file_name);
        const data = fs.readFileSync(file_path);
        certs.push(data);
    });
    return certs;
}

async function getSubmitter(client, peerAdmin) {
//module.exports.getSubmitter = function(client, peerAdmin) {
    logger.info('sdk-node : enter getSubmitter');
    const store = await Client.newDefaultKeyValueStore({
        path: '/tmp/hfc-test-kvs_peerOrg1'});
    client.setStateStore(store);
    if (peerAdmin) {
        return getAdmin(client);
    } else {
        return getMember('jassitest', 'welcome1', client);
    }
}
/*
async function enrollAndRegister() {

    const network = await commonUtils.parseBasicNetworkYaml();
    const adminUser = network.certificateAuthorities[caName].registrar[0].enrollId;
    const adminPassword = network.certificateAuthorities[caName].registrar[0].enrollSecret;

    //const adminUser = ccp.certificateAuthorities['5f93f821-0956-40a0-8c8f-d75d3f01caa0-ca'].registrar[0].enrollId;
    //const adminPassword = ccp.certificateAuthorities['5f93f821-0956-40a0-8c8f-d75d3f01caa0-ca'].registrar[0].enrollSecret;

    logger.info('Admin User:', adminUser);
    logger.info('Admin Password:', adminPassword);

    const newUser = 'ajinkya.pande@oracle.com';
    const newUserPassword = 'Ajcrypto@1230';

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    logger.info('Wallet path: ${walletPath}');

    try {

        // Create a new CA client for interacting with the CA.
        const caURL = network.certificateAuthorities[caName].url;
        const ca = new FabricCAServices(caURL);

        // Check to see if we've already enrolled the admin user.
        const adminEnrolled = await wallet.exists(adminUser);
        if (adminEnrolled) {
            logger.info('An identity for the admin user ' + adminUser + ' already exists in the wallet');
            // return;
        } else {

            // Enroll the admin user, and import the new identity into the wallet.
            const adminEnrollment = await ca.enroll({enrollmentID: adminUser, enrollmentSecret: adminPassword});
            const identity = X509WalletMixin.createIdentity(network.name, adminEnrollment.certificate, adminEnrollment.key.toBytes());
            await wallet.import(adminUser, identity);
            logger.info('Successfully enrolled admin user ' + adminUser + ' and imported it into the wallet');
        }
        logger.info('************************ Admin User is Enrolled as Registrar *************************** ');
    } catch (error) {
        console.error('Failed to enroll Admin user ' + adminUser + ':', error);
        process.exit(1);
    }

    try {
        const userExists = await wallet.exists(newUser);
        if (userExists) {
            logger.info('An identity for the user ' +  newUser + ' already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists(adminUser);
        if (!adminExists) {
            logger.info('An identity for the admin user "admin" does not exist in the wallet');
            // logger.info('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(network, {wallet, identity: adminUser, discovery: {enabled: false}});

        // Get the CA client object from the gateway for interacting with the CA.
        const caRegisterEnroll = gateway.getClient().getCertificateAuthority();
        // logger.info('caRegisterEnroll:', caRegisterEnroll);
        const adminIdentity = gateway.getCurrentIdentity();
        // logger.info('adminIdentity:', adminIdentity);

        const userAttributes = [
            {ecert:true, name:'hf.Registrar.Roles', value:'*'},
            {ecert:true, name:'hf.Revoker', value:'true'},
            {ecert:true, name:'hf.Registrar.DelegateRoles', value:'*'},
            {ecert:true, name:'hf.Registrar.Attributes', value:'*'},
            {ecert:true, name:'hf.GenCRL', value:'true'},
            {ecert:true, name:'hf.IntermediateCA', value:'true'},
            {ecert:true, name:'hf.AffiliationMgr', value:'true'}];

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await caRegisterEnroll.register({affiliation: network.name, enrollmentID: newUser, role: 'client', attrs: userAttributes}, adminIdentity);
        logger.info('Secret Returned:', secret);
        const enrollment = await caRegisterEnroll.enroll({enrollmentID: newUser, enrollmentSecret: newUserPassword});
        const userIdentity = X509WalletMixin.createIdentity(network.name, enrollment.certificate, enrollment.key.toBytes());
        await wallet.import(newUser, userIdentity);
        logger.info('Successfully registered and enrolled New User ' + newUser + ' and imported it into the wallet. . .');

    } catch (error) {
        console.error('Failed to Register New User ' + newUser + ' :', error);
        process.exit(1);
    }
}

enrollAndRegister();
*/
function testClient(client) {
	logger.info('sdk-node : enter testClient');
	getSubmitter(client, false);
	logger.info('sdk-node : testClient : getPeersForOrgOnChannel');
	const orgPeers = client.getPeersForOrgOnChannel('default');
	logger.info('sdk-node : testClient : orgPeers' + util.inspect(orgPeers));
    logger.info('sdk-node : testClient done');
}
