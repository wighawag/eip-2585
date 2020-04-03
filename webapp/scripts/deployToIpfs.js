const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const recursive = require('recursive-fs');
const basePathConverter = require('base-path-converter');
const slash = require('slash');

const pinataCredentials = JSON.parse(fs.readFileSync('.pinata').toString());

const pinDirectoryToIPFS = (src, {name, config}) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    //we gather the files from a local directory in this example, but a valid readStream is all that's needed for each file in the directory.
    recursive.readdirr(src, function (err, dirs, files) {
        let data = new FormData();
        files.map(slash).forEach((file) => {
            //for each file stream, we need to include the correct relative file path
            const filepath = basePathConverter(src, file);
            console.log(src, file, filepath);
            data.append(`file`, fs.createReadStream(file), {
                filepath
            })
        });
    
        const metadata = JSON.stringify({
            name,
            // keyvalues: {
            //     timestamp: '' + Math.floor(Date.now() / 1000)
            // }
        });
        data.append('pinataMetadata', metadata);

        config = config || {
            cidVersion: 0
        };
        const pinataOptions = JSON.stringify(config);
        data.append('pinataOptions', pinataOptions);
    
        console.log({
            metadata,
            pinataOptions,
        });
        return axios.post(url,
            data,
            {
                maxContentLength: 'Infinity', //this is needed to prevent axios from erroring out with large directories
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                    'pinata_api_key': pinataCredentials.apiKey,
                    'pinata_secret_api_key': pinataCredentials.secret
                }
            }
        ).then(function (response) {
            console.log(JSON.stringify(response.data, null, '  '));
            //handle response here
        }).catch(function (error) {
            console.error(JSON.stringify(error.message, null, '  '));
            //handle error here
        });
    });
};

(async () => {
    await pinDirectoryToIPFS('__sapper__/export',
        {name: 'metatx.eth_v2',
        config: {
            cidVersion: 0
        }
    });
})()
