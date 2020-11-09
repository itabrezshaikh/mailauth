![](https://github.com/andris9/mailauth/raw/master/assets/mailauth.png)

Email authentication library for Node.js

-   [x] SPF verification
-   [x] DKIM signing
-   [x] DKIM verification
-   [x] DMARC verification
-   [x] ARC verification
-   [x] ARC sealing
    -   [x] Sealing on authentication
    -   [x] Sealing after modifications
-   [x] BIMI resolving

Pure JavaScript implementation, no external applications or compilation needed. Runs on any server/device that has Node 14+ installed.

## Usage

## Authentication

Validate DKIM signatures, SPF, DMARC, ARC and BIMI for an email.

```js
const { authenticate } = require('mailauth');
const { dkim, spf, arc, dmarc, bimi, headers } = await authenticate(
    message, // either a String, a Buffer or a Readable Stream
    {
        // SMTP transmission options must be provided as
        // these are not parsed from the message
        ip: '217.146.67.33', // SMTP client IP
        helo: 'uvn-67-33.tll01.zonevs.eu', // EHLO/HELO hostname
        mta: 'mx.ethereal.email', // server processing this message, defaults to os.hostname()
        sender: 'andris@ekiri.ee', // MAIL FROM address

        //  Optional  DNS resolver function (defaults to `dns.promises.resolve`)
        resolver: async (name, rr) => await dns.promises.resolve(name, rr)
    }
);
// output authenticated message
process.stdout.write(headers); // includes terminating line break
process.stdout.write(message);
```

Example output:

```
Received-SPF: pass (mx.ethereal.email: domain of andris@ekiri.ee designates 217.146.67.33 as permitted sender) client-ip=217.146.67.33;
Authentication-Results: mx.ethereal.email;
 dkim=pass header.i=@ekiri.ee header.s=default header.a=rsa-sha256 header.b=TXuCNlsq;
 spf=pass (mx.ethereal.email: domain of andris@ekiri.ee designates 217.146.67.33 as permitted sender) smtp.mailfrom=andris@ekiri.ee
 smtp.helo=uvn-67-33.tll01.zonevs.eu;
 arc=pass (i=2 spf=neutral dkim=pass dkdomain=ekiri.ee);
 dmarc=none header.from=ekiri.ee
From: ...
```

You can see full output (structured data for DKIM, SPF, DMARC and ARC) from [this example](https://gist.github.com/andris9/6514b5e7c59154a5b08636f99052ce37).

## DKIM

### Signing

```js
const { dkimSign } = require('mailauth/lib/dkim/sign');
const signResult = await dkimSign(
    message, // either a String, a Buffer or a Readable Stream
    {
        // Optional, default canonicalization, default is "relaxed/relaxed"
        canonicalization: 'relaxed/relaxed', // c=

        // Optional, default signing and hashing algorithm
        // Mostly useful when you want to use rsa-sha1, otherwise no need to set
        algorithm: 'rsa-sha256',

        // Optional, default is current time
        signTime: new Date(), // t=

        // Keys for one or more signatures
        // Different signatures can use different algorithms (mostly useful when
        // you want to sign a message both with RSA and Ed25519)
        signatureData: [
            {
                signingDomain: 'tahvel.info', // d=
                selector: 'test.rsa', // s=
                // supported key types: RSA, Ed25519
                privateKey: fs.readFileSync('./test/fixtures/private-rsa.pem'),

                // Optional algorithm, default is derived from the key.
                // Overrides whatever was set in parent object
                algorithm: 'rsa-sha256',

                // Optional signature specifc canonicalization, overrides whatever was set in parent object
                canonicalization: 'relaxed/relaxed' // c=
            }
        ]
    }
); // -> {signatures: String, errors: Array} signature headers using \r\n as the line separator
// show signing errors (if any)
if (signResult.errors.length) {
    console.log(signResult.errors);
}
// output signed message
process.stdout.write(signResult.signatures); // includes terminating line break
process.stdout.write(message);
```

Example output:

```
DKIM-Signature: a=rsa-sha256; v=1; c=relaxed/relaxed; d=tahvel.info;
 s=test.rsa; b=...
From: ...
```

### Verifying

```js
const { dkimVerify } = require('mailauth/lib/dkim/verify');
// `message` is either a String, a Buffer or a Readable Stream
const result = await dkimVerify(message);
for (let { info } of result.results) {
    console.log(info);
}
```

Example output:

```txt
dkim=neutral (invalid public key) header.i=@tahvel.info header.s=test.invalid header.b="b85yao+1"
dkim=pass header.i=@tahvel.info header.s=test.rsa header.b="BrEgDN4A"
dkim=policy policy.dkim-rules=weak-key header.i=@tahvel.info header.s=test.small header.b="d0jjgPun"
```

## SPF

### Verifying

```js
const { spf } = require('mailauth/lib/spf');

let result = await spf({
    sender: 'andris@wildduck.email',
    ip: '217.146.76.20',
    helo: 'foo',
    mta: 'mx.myhost.com'
});
console.log(result.header);
```

Example output:

```txt
Received-SPF: pass (mx.myhost.com: domain of andris@wildduck.email
 designates 217.146.76.20 as permitted sender) client-ip=217.146.76.20;
 envelope-from="andris@wildduck.email";
```

## ARC

### Validation

ARC seals are automatically validated during the authentication step.

```js
const { authenticate } = require('mailauth');
const { arc } = await authenticate(
    message, // either a String, a Buffer or a Readable Stream
    {
        // SMTP transmission options must be provided as
        // these are not parsed from the message
        ip: '217.146.67.33', // SMTP client IP
        helo: 'uvn-67-33.tll01.zonevs.eu', // EHLO/HELO hostname
        mta: 'mx.ethereal.email', // server processing this message, defaults to os.hostname()
        sender: 'andris@ekiri.ee' // MAIL FROM address
    }
);
console.log(arc);
```

Output being something like this:

```
{
  "status": {
    "result": "pass",
    "comment": "i=2 spf=neutral dkim=pass dkdomain=zonevs.eu dkim=pass dkdomain=srs3.zonevs.eu dmarc=fail fromdomain=zone.ee"
  },
  "i": 2,
  ...
}
```

### Sealing

#### During authentication

You can seal messages with ARC automatically in the authentication step by providing the sealing key. In this case you can not modify the message anymore as this would break the seal.

```js
const { authenticate } = require('mailauth');
const { headers } = await authenticate(
    message, // either a String, a Buffer or a Readable Stream
    {
        // SMTP transmission options must be provided as
        // these are not parsed from the message
        ip: '217.146.67.33', // SMTP client IP
        helo: 'uvn-67-33.tll01.zonevs.eu', // EHLO/HELO hostname
        mta: 'mx.ethereal.email', // server processing this message, defaults to os.hostname()
        sender: 'andris@ekiri.ee', // MAIL FROM address

        // Optional ARC seal settings. If this is set then resulting headers include
        // a complete ARC header set (unless the message has a failing ARC chain)
        seal: {
            signingDomain: 'tahvel.info',
            selector: 'test.rsa',
            privateKey: fs.readFileSync('./test/fixtures/private-rsa.pem')
        }
    }
);
// output authenticated and sealed message
process.stdout.write(headers); // includes terminating line break
process.stdout.write(message);
```

#### After modifications

If you want to modify the message before sealing then you have to authenticate the message first and then use authentication results as input for the sealing step.

```js
const { authenticate, sealMessage } = require('@postalsys/mailauth');

// 1. authenticate the message
const { arc, headers } = await authenticate(
    message, // either a String, a Buffer or a Readable Stream
    {
        ip: '217.146.67.33', // SMTP client IP
        helo: 'uvn-67-33.tll01.zonevs.eu', // EHLO/HELO hostname
        mta: 'mx.ethereal.email', // server processing this message, defaults to os.hostname()
        sender: 'andris@ekiri.ee' // MAIL FROM address
    }
);

// 2. perform some modifications with the message ...

// 3. seal the modified message using the initial authentication results
const sealHeaders = await sealMessage(message, {
    signingDomain: 'tahvel.info',
    selector: 'test.rsa',
    privateKey: fs.readFileSync('./test/fixtures/private-rsa.pem'),

    // values from the authentication step
    authResults: arc.authResults,
    cv: arc.status.result
});

// output authenticated message
process.stdout.write(sealHeaders); // ARC set
process.stdout.write(headers); // authentication results
process.stdout.write(message);
```

## BIMI

Brand Indicators for Message Identification (BIMI) support is based on [draft-blank-ietf-bimi-01](https://tools.ietf.org/html/draft-blank-ietf-bimi-01).

BIMI information is resolved in the authentication step and the results can be found from the `bimi` property. Message must pass DMARC validation in order to be processed for BIMI. DMARC policy can not be "none" for BIMI to pass.

```js
const { bimi } = await authenticate(
    message, // either a String, a Buffer or a Readable Stream
    {
        ip: '217.146.67.33', // SMTP client IP
        helo: 'uvn-67-33.tll01.zonevs.eu', // EHLO/HELO hostname
        mta: 'mx.ethereal.email', // server processing this message, defaults to os.hostname()
        sender: 'andris@ekiri.ee' // MAIL FROM address
    }
);
if (bimi?.location) {
    console.log(`BIMI location: ${bimi.location}`);
}
```

`BIMI-Location` header is ignored by `mailauth`, it is not checked for and it is not modified in any way if it is present. `BIMI-Selector` is used for selector selection (if available).

> **NB!** Authority Evidence Documents for BIMI are not validated even if these are available. You can get the URL for validating it yourself from `bimi.authority` property.

## Testing

`mailauth` uses the following test suites:

### SPF test suite

[OpenSPF test suite](http://www.openspf.org/Test_Suite) with the following differences:

-   No PTR support in `mailauth`, all PTR related tests are ignored
-   Less strict whitespace checks (`mailauth` accepts multiple spaces between tags etc)
-   Some macro tests are skipped (macro expansion is supported _in most parts_)
-   Some tests where invalid component is listed after a matching part (mailauth processes from left to right and returns on first match found)
-   Other than that all tests pass

### ARC test suite from ValiMail

ValiMail [arc_test_suite](https://github.com/ValiMail/arc_test_suite)

-   `mailauth` is less strict on header tags and casing, for example uppercase `S=` for a selector passes in `mailauth` but fails in ValiMail.
-   Signing test suite is used for input only. All listed messages are signed using provided keys but signatures are not matched against reference. Instead `mailauth` validates the signatures itself and looks for the same cv= output that the ARC-Seal header in the test suite has
-   Other than that all tests pass

## Setup

### Free, AGPL-licensed version

First install the module from npm:

```
$ npm install mailauth
```

next import any method you want to use from mailauth package into your script:

```js
const { authenticate } = require('mailauth');
```

### MIT version

MIT-licensed version is available for [Postal Systems subscribers](https://postalsys.com/).

First install the module from Postal Systems private registry:

```
$ npm install @postalsys/mailauth
```

next import any method you want to use from mailauth package into your script:

```js
const { authenticate } = require('@postalsys/mailauth');
```

If you have already built your application using the free version of "mailauth" and do not want to modify require statements in your code, you can install the MIT-licensed version as an alias for "mailauth".

```
$ npm install mailauth@npm:@postalsys/mailauth
```

This way you can keep using the old module name

```js
const { authenticate } = require('mailauth');
```

## License

&copy; 2020 Andris Reinman

Licensed under GNU Affero General Public License v3.0 or later.

MIT-licensed version of mailauth is available for [Postal Systems subscribers](https://postalsys.com/).
