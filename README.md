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

### vault.login(options, [callback])
Create a new session with vault server and periodically refresh it.  
*currently the 'userpass' backend is the only supported backend*

###### Params
| param | type | description |
| :--- | :---: | :--- |
| options* | `{Object} | login options |
| options.backend* | `{String}` | the backend to use. currently supported backends: userpass |
| options.options* | `{Object}` | backend specific options |
| options.renew_interval | `{String}` | the renewal interval |

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
    console.log(results);
})

// promise style
vault.get('/secrets/foo', {
    timeout: 1000
}).then(function(res) {
    // res is an axios res object
}).catch(function(err) {
    // catch any errors
});
```

## Events
| name | callback | description |
| :--- | :--- | :--- |
| error | `function(err)` | all errors will bubbble to here |
| error:login | `function(err)` | login errors |

## Testing
*requires up to date versions of docker & docker-compose*
```bash
docker-compose up
```

## Contributing
1. [Fork it](https://github.com/cludden/vault-client/fork)
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## License
Copyright (c) 2016 Chris Ludden
Licensed under the [MIT License](LICENSE.md);
