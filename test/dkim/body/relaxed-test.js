/* eslint no-unused-expressions:0 */
'use strict';

const { resolveStream } = require('../../../lib/tools');
const chai = require('chai');
const expect = chai.expect;

let fs = require('fs').promises;
let { RelaxedBody } = require('../../../lib/dkim/body/relaxed');

chai.config.includeStack = true;

describe('DKIM RelaxedBody Tests', () => {
    it('Should calculate sha256 body hash for an empty message', async () => {
        const message = Buffer.from('\r\n\n\r\n\r\n');

        let s = new RelaxedBody({
            hashAlgo: 'sha256'
        });

        let hash;
        // 'hash' is triggered before stream end
        s.on('hash', h => {
            hash = h;
        });

        await resolveStream(s, message, 1);
        expect(hash).to.equal('47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    });

    it('Should calculate sha1 body hash for an empty message', async () => {
        const message = Buffer.from('\r\n\n\r\n\r\n');

        let s = new RelaxedBody({
            hashAlgo: 'sha1'
        });

        let hash;
        // 'hash' is triggered before stream end
        s.on('hash', h => {
            hash = h;
        });

        await resolveStream(s, message, 1);
        expect(hash).to.equal('2jmj7l5rSw0yVb/vlWAYkK/YBwk=');
    });

    it('Should calculate body hash byte by byte', async () => {
        let message = await fs.readFile(__dirname + '/../../fixtures/message1.eml', 'utf-8');

        message = message.replace(/\r?\n/g, '\r\n');
        message = message.split('\r\n\r\n');
        message.shift();
        message = message.join('\r\n\r\n');

        message = Buffer.from(message);

        let s = new RelaxedBody({
            hashAlgo: 'sha256'
        });

        let hash;
        // 'hash' is triggered before stream end
        s.on('hash', h => {
            hash = h;
        });

        await resolveStream(s, message, 1);
        expect(hash).to.equal('D2H5TEwtUgM2u8Ew0gG6vnt/Na6L+Zep7apmSmfy8IQ=');
    });

    it('Should calculate body hash all at once', async () => {
        let message = await fs.readFile(__dirname + '/../../fixtures/message1.eml', 'utf-8');

        message = message.replace(/\r?\n/g, '\r\n');
        message = message.split('\r\n\r\n');
        message.shift();
        message = message.join('\r\n\r\n');

        message = Buffer.from(message);

        let s = new RelaxedBody({
            hashAlgo: 'sha256'
        });

        let hash;
        // 'hash' is triggered before stream end
        s.on('hash', h => {
            hash = h;
        });

        await resolveStream(s, message, 1000000);
        expect(hash).to.equal('D2H5TEwtUgM2u8Ew0gG6vnt/Na6L+Zep7apmSmfy8IQ=');
    });
});
