# vault-client
a node client for HashiCorp's [vault](https://www.vaultproject.io/).

*note: work in progress*

## Installing
```bash
npm install --save vault-client
```

## Getting Started
```javascript
const Vault = require('vault-client');
const vault = new Vault({
    url: 'https://vault.example.com'
});

async.waterfall([
    function login(next) {
        vault.login({
            backend: 'userpass',
            options: {
                username: 'bob',
                password: 'password1'
            },
            retry: {
                forever: true,
                minTimeout: 1000,
                maxTimeout: 1000 * 60 * 10
            }
        }, fn);
    },

    function secrets(next) {
        vault.get('/secrets/foo', next);
    }
], function(err, results) {
    if (err) {
        console.error(err);
    } else {
        console.log(JSON.stringify(results.data));
    }
});
```

## API
### Vault(options)
Creates a new `vault` client.

###### Params
| param | type | description |
| :--- | :---: | :--- |
| options* | `{Object}` | options |
| options.url* | `{String}` | the base url of the vault server |

###### Example
```javascript
const Vault = require('vault-client');
const vault = new Vault({
    url: 'https://localhost:8200/v1'
});
```

### vault.get(url, [config], [cb])

###### Params
| param | type | description |
| :--- | :---: | :--- |
| url* | `{String}` | relative url |
| config | `{Object}` | [axios](https://github.com/mzabriskie/axios) configuration object |
| cb | `{Function}` | node style callback |

###### Example
```javascript
// node style
vault.get('/secrets/foo', {
    timeout: 1000
}, function(err, results) {

})

// promise style
vault.get('/secrets/foo', {
    timeout: 1000
}).then(function(res) {

}).catch(function(err) {

});
```

## Events
| name | callback | description |
| :--- | :--- | :--- |
| error | `function(err)` | all errors will bubbble to here |
| error:login | `function(err)` | login errors |
