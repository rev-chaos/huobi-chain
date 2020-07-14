/* eslint-env node, jest */
import { Account } from '@mutadev/account';
import { Client } from '@mutadev/client';
import { BigNumber } from '@mutadev/shared';
import { AssetService } from 'huobi-chain-sdk';
import { genRandomString } from './utils';

const account = Account.fromPrivateKey(
  '0x2b672bb959fa7a852d7259b129b65aee9c83b39f427d6f7bded1f58c4c9310c2',
);
const native_asset_id = "0xf56924db538e77bb5951eb5ff0d02b88983c49c45eea30e8ae3e7234b311436c";
const basic_fee = 51000;

const client = new Client({
  defaultCyclesLimit: '0xffffffff',
});
// 在测试 asset service 的时候，构造一个转账交易，把余额全取走，没有钱留给交易费，看结果怎么样？

describe('asset service API test via huobi-sdk-js', () => {
  test('test create_asset', async () => {
    const service = new AssetService(client, account);
    const name = genRandomString('c', 20);
    const symbol = genRandomString('S', 5);
    const supply = 0xfffffffffff;
    const precision = 18;
    const relayable = false;
    const res0 = await service.write.create_asset({
      name,
      symbol,
      supply,
      precision,
      relayable,
    });
    expect(Number(res0.response.response.code)).toBe(0);
    expect(Number(res0.cyclesUsed)).toBe(basic_fee);
    const asset = res0.response.response.succeedData;
    expect(asset.name).toBe(name);
    expect(asset.symbol).toBe(symbol);
    expect(asset.supply).toBe(supply);
    expect(asset.precision).toBe(precision);
    expect(asset.relayable).toBe(relayable);

    const asset_id = asset.id;
    const res1 = await service.read.get_asset({ id : asset_id });
    expect(Number(res1.code)).toBe(0);
    const data = res1.succeedData;
    expect(data.name).toBe(name);
    expect(data.symbol).toBe(symbol);
    expect(data.supply).toBe(supply);
    expect(data.precision).toBe(precision);
    expect(data.relayable).toBe(relayable);
  });

  test('test transfer', async () => {
    const newAccount = Account.fromPrivateKey(
      '0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f',
    );
    const service = new AssetService(client, account);

    const res0 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: newAccount.address,
    });
    expect(Number(res0.code)).toBe(0);
    expect(res0.succeedData.asset_id).toBe(native_asset_id);
    expect(res0.succeedData.user).toBe(newAccount.address);
    const balance_a = Number(res0.succeedData.balance);

    const res1 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: account.address,
    });
    expect(Number(res1.code)).toBe(0);
    const balance_b = Number(res1.succeedData.balance);

    const value = 0xfffff;
    const res2 = await service.write.transfer({
      asset_id: native_asset_id,
      to: newAccount.address,
      value,
      memo: 'test',
    });
    expect(Number(res2.response.response.code)).toBe(0);
    expect(Number(res2.cyclesUsed)).toBe(basic_fee);

    const res3 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: newAccount.address,
    });
    expect(Number(res3.code)).toBe(0);

    // check balance
    const balance_add = Number(res3.succeedData.balance) - balance_a;
    expect(balance_add).toBe(value);

    const res4 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: account.address,
    });
    expect(Number(res4.code)).toBe(0);
    const balance_sub = balance_b - Number(res4.succeedData.balance);
    console.log(balance_sub);
//     expect(balance_sub).toBe(value + basic_fee);
  });

  test('test approve and transfer_from', async () => {
    const account1 = Account.fromPrivateKey(
      '0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f',
    );
    const account2 = Account.fromPrivateKey(
      '0x16f55be689dca766191ad3446897e0f480da2222a89626020251411e1a587c5a',
    );
    const service = new AssetService(client, account);
    // require balance
    const res2 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: account2.address,
    });
    const balance_before = Number(res2.succeedData.balance);

    // approve
    const value0 = 0xfffff;
    const memo = 'approve_test';
    const res3 = await service.write.approve({
      asset_id: native_asset_id,
      to: account1.address,
      value: value0,
      memo,
    });
    expect(Number(res3.response.response.code)).toBe(0);
    expect(Number(res3.cyclesUsed)).toBe(basic_fee);
    const data = JSON.parse(res3.events[0].data);
    expect(data.asset_id).toBe(native_asset_id);
    expect(data.grantor).toBe(account.address);
    expect(data.grantee).toBe(account1.address);
    expect(data.value).toBe(value0);
    expect(data.memo).toBe(memo);

    // get_allowance
    const res4 = await service.read.get_allowance({
      asset_id: native_asset_id,
      grantor: account.address,
      grantee: account1.address,
    });
    expect(Number(res4.code)).toBe(0);
    expect(Number(res4.succeedData.value)).toBe(value0);

    // transfer_from
    const memo1 = 'transfer_from test';
    const value1 = 0x65a41;
    const service1 = new AssetService(client, account1);
    const res5 = await service1.write.transfer_from({
      asset_id: native_asset_id,
      sender: account.address,
      recipient: account2.address,
      value: value1,
      memo: memo1,
    });
    expect(Number(res5.response.response.code)).toBe(0);
    expect(Number(res5.cyclesUsed)).toBe(basic_fee);
    const data1 = JSON.parse(res5.events[0].data);
    expect(data1.asset_id).toBe(native_asset_id);
    expect(data1.caller).toBe(account1.address);
    expect(data1.sender).toBe(account.address);
    expect(data1.recipient).toBe(account2.address);
    expect(data1.value).toBe(value1);
    expect(data1.memo).toBe(memo1);

    // check balance
    const res6 = await service.read.get_allowance({
      asset_id: native_asset_id,
      grantor: account.address,
      grantee: account1.address,
    });
    expect(Number(res6.code)).toBe(0);
    expect(Number(res6.succeedData.value)).toBe(value0 - value1);

    const res7 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: account2.address,
    });
    const balance_after = Number(res7.succeedData.balance);
    expect(balance_after - balance_before).toBe(value1);
  });

  test('test mint', async () => {
    const service = new AssetService(client, account);
    const newAccount = Account.fromPrivateKey(
      '0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f',
    );
    // require balance
    const res0 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: newAccount.address,
    });
    const balance_before = Number(res0.succeedData.balance);

    const res01 = await service.read.get_native_asset();
    const supply_before = new BigNumber(res01.succeedData.supply);

    // mint
    const amount = 0x3ab12451;
    const proof = '0x23311';
    const memo = 'test memo';
    const res1 = await service.write.mint({
      asset_id: native_asset_id,
      to: newAccount.address,
      amount,
      proof,
      memo,
    });
    expect(Number(res1.response.response.code)).toBe(0);
    expect(Number(res1.cyclesUsed)).toBe(basic_fee);
    const data = JSON.parse(res1.events[0].data);
    expect(data.asset_id).toBe(native_asset_id);
    expect(data.to).toBe(newAccount.address);
    expect(Number(data.amount)).toBe(amount);
    expect(data.proof).toBe(proof);
    expect(data.memo).toBe(memo);

    // check balance
    const res2 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: newAccount.address,
    });
    const balance_after = Number(res2.succeedData.balance);
    expect(balance_after - balance_before).toBe(amount);

    // check total_supply
    const res3 = await service.read.get_native_asset();
    const supply_after = new BigNumber(res3.succeedData.supply);
    expect(supply_after.minus(supply_before).eq(amount)).toBe(true);
  });

  test('test burn', async () => {
    const service = new AssetService(client, account);
    // require balance
    const res0 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: account.address,
    });
    const balance_before = new BigNumber(res0.succeedData.balance);

    const res01 = await service.read.get_native_asset();
    const supply_before = new BigNumber(res01.succeedData.supply);

    // burn
    const amount = 0x3ab12451;
    const proof = '0x23311';
    const memo = 'test memo';
    const res1 = await service.write.burn({
      asset_id: native_asset_id,
      amount,
      proof,
      memo,
    });
    expect(Number(res1.response.response.code)).toBe(0);
    expect(Number(res1.cyclesUsed)).toBe(basic_fee);
    const data = JSON.parse(res1.events[0].data);
    expect(data.asset_id).toBe(native_asset_id);
    expect(data.from).toBe(account.address);
    expect(Number(data.amount)).toBe(amount);
    expect(data.proof).toBe(proof);
    expect(data.memo).toBe(memo);

    // check balance
    const res2 = await service.read.get_balance({
      asset_id: native_asset_id,
      user: account.address,
    });
    const balance_after = new BigNumber(res2.succeedData.balance);
    expect(balance_before.minus(balance_after).eq(amount)).toBe(true);

    // check total_supply
    const res3 = await service.read.get_native_asset();
    const supply_after = new BigNumber(res3.succeedData.supply);
    console.log(supply_after);
    expect(supply_before.minus(supply_after).eq(amount)).toBe(true);
  });

  test('test relay', async () => {
    const service = new AssetService(client, account);
    const name = genRandomString('c', 20);
    const symbol = genRandomString('S', 5);
    const res0 = await service.write.create_asset({
      name,
      symbol,
      supply: 0xfffffffffff,
      precision: 18,
      relayable: false,
    });
    expect(Number(res0.response.response.code)).toBe(0);
    const asset_id = res0.response.response.succeedData.id;

    // test relay of unrelayable asset
    const amount = 0x3ab12451;
    const proof = '0x23311';
    const memo = 'test relay';
    const res1 = await service.write.relay({
      asset_id,
      amount,
      proof,
      memo,
    });
    expect(Number(res1.response.response.code)).toBe(0x6f);
    expect(Number(res1.cyclesUsed)).toBe(basic_fee);
    expect(res1.response.response.errorMessage).toBe('Asset is not relay-able');

    // test relay of relayable asset
    const res2 = await service.write.create_asset({
      name,
      symbol,
      supply: 0xfffffffffff,
      precision: 18,
      relayable: true,
    });
    expect(Number(res2.response.response.code)).toBe(0);
    const asset_id2 = res2.response.response.succeedData.id;

    const res3 = await service.write.relay({
      asset_id: asset_id2,
      amount,
      proof,
      memo,
    });
    expect(Number(res3.response.response.code)).toBe(0);
  });

  test('test change_admin', async () => {
    const service = new AssetService(client, account);
    const newAccount = Account.fromPrivateKey(
      '0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f',
    );
    const newService = new AssetService(client, newAccount);

    // test mint, change_admin of un-admin
    const amount = 0x3ab12451;
    const proof = '0x23311';
    const memo = 'test memo';
    const res0 = await newService.write.mint({
      asset_id: native_asset_id,
      to: newAccount.address,
      amount,
      proof,
      memo,
    });
    expect(Number(res0.response.response.code)).toBe(0x6d);
    expect(Number(res0.cyclesUsed)).toBe(basic_fee);
    expect(res0.response.response.errorMessage).toBe('Unauthorized');

    const res1 = await newService.write.change_admin({
      addr: newAccount.address,
    });
    expect(Number(res1.response.response.code)).toBe(0x6d);
    expect(Number(res1.cyclesUsed)).toBe(basic_fee);
    expect(res1.response.response.errorMessage).toBe('Unauthorized');

    // change_admin
    const res2 = await service.write.change_admin({
      addr: newAccount.address,
    });
    expect(Number(res2.response.response.code)).toBe(0);
    expect(Number(res2.cyclesUsed)).toBe(basic_fee);

    // check mint, change_admin
    const res3 = await newService.write.mint({
      asset_id: native_asset_id,
      to: newAccount.address,
      amount,
      proof,
      memo,
    });
    expect(Number(res3.response.response.code)).toBe(0);

    const res4 = await newService.write.change_admin({
      addr: account.address,
    });
    expect(Number(res4.response.response.code)).toBe(0);
  });
});