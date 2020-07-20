import { utils } from '@mutadev/muta-sdk';
import { Client } from '@mutadev/client';
import { Account } from '@mutadev/account';

const { hexToNum } = utils;

const ADMIN_PRIVATE_KEY = '0x2b672bb959fa7a852d7259b129b65aee9c83b39f427d6f7bded1f58c4c9310c2';

const client = new Client({
  defaultCyclesLimit: '0xffffffff',
});

const admin: Account = Account.fromPrivateKey(ADMIN_PRIVATE_KEY);
const nativeAssetId = "0xf56924db538e77bb5951eb5ff0d02b88983c49c45eea30e8ae3e7234b311436c";
const randomString = require("randomstring");

export function genRandomString(prefix: String = 'r', length: number = 12) {
  expect(prefix.length <= length);
  return prefix + randomString.generate(length - prefix.length);
}

export function genRandomStrings(size: number = 3, prefix: String = 't', length: number = 12) {
  const names = new Array(0);

  for(var i = 0; i < size; i++) {
    names.push(genRandomString(prefix, length));
  }

  return names;
}

export function genRandomAccount() {
  const randomPriKey = randomString.generate({
    charset: '0123456789abcdef',
    length: 64,
  });
  return Account.fromPrivateKey('0x' + randomPriKey);
}

export {
  admin, client, hexToNum, nativeAssetId
};
