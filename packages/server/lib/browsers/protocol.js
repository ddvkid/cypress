const _ = require('lodash')
const CRI = require('chrome-remote-interface')
const { connect } = require('@packages/network')
const Promise = require('bluebird')
const la = require('lazy-ass')
const is = require('check-more-types')
const pluralize = require('pluralize')
const debug = require('debug')('cypress:server:protocol')

function getDelayMsForRetry (i) {
  if (i < 8) {
    return 100
  }

  if (i < 10) {
    return 500
  }
}

function connectAsync (opts) {
  return Promise.fromCallback((cb) => {
    connect.createRetryingSocket({
      getDelayMsForRetry,
      ...opts,
    }, cb)
  })
}

/**
 * Waits for the port to respond with connection to Chrome Remote Interface
 * @param {number} port Port number to connect to
 */
const getWsTargetFor = (port) => {
  debug('Getting WS connection to CRI on port %d', port)
  la(is.port(port), 'expected port number', port)

  return connectAsync({ port })
  .catch((err) => {
    debug('failed to connect to CDP %o', { port, err })
    throw err
  })
  .then(() => {
    debug('CRI.List on port %d', port)

    // what happens if the next call throws an error?
    // it seems to leave the browser instance open
    return CRI.List({ port })
  })
  .then((targets) => {
    debug(
      'CRI list has %s %o',
      pluralize('targets', targets.length, true),
      targets
    )
    // activate the first available id

    // find the first target page that's a real tab
    // and not the dev tools or background page.
    // since we open a blank page first, it has a special url
    const newTabTargetFields = {
      type: 'page',
      url: 'about:blank',
    }
    const target = _.find(targets, newTabTargetFields)

    la(target, 'could not find CRI target')
    debug('found CRI target %o', target)

    return target.webSocketDebuggerUrl
  })
}

module.exports = {
  getWsTargetFor,
}
