import Bluebird from 'bluebird';
import lt from 'long-timeout';
import retry from 'retry';
import _ from 'lodash';

import backends from './backends';

export function login(options) {
  const prior = this.store.get('_auth') || {};
  const opts = options || prior.login;

  if (prior.renewal) {
    lt.clearTimeout(prior.renewal);
  }

  return this.validate('login-options', opts)
  .then(() => this.store.set('_auth.login', opts))
  .then(() => {
    return new Bluebird((resolve, reject) => {
      const backend = backends[options.backend];
      const operation = retry.operation(options.retry);
      operation.attempt(() => {
        backend.login(this, options.options)
        .then(auth => resolve(auth))
        .catch((err) => {
          if (_.get(err, 'response.status', 500) < 500) {
            operation.stop();
          }
          if (operation.retry(err)) {
            return;
          }
          return reject(err);
        });
      });
    })
    .then(auth => this.validate('auth-response-data', auth))
    .then((auth) => {
      this.store.set('_auth.data', auth);
      if (auth.lease_duration > 0) {
        this.store.set('_auth.renewal', lt.setTimeout(() => {
          this.login();
        }, auth.lease_duration * 1000));
      }
    });
  });
}

export function logout() {

}
