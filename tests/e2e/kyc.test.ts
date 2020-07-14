import { Account } from '@mutadev/account';
import { Client } from '@mutadev/client';
import { AssetService, KycService } from 'huobi-chain-sdk';
import { genRandomString, genRandomStrings } from './utils';

const account = Account.fromPrivateKey(
  '0x2b672bb959fa7a852d7259b129b65aee9c83b39f427d6f7bded1f58c4c9310c2',
);
const client = new Client({
  defaultCyclesLimit: '0xffffffff',
});

const basic_fee = 51000;

describe('kyc service API test via huobi-sdk-js', () => {
  test('test register_org', async () => {
    // before register
    const service = new KycService(client, account);
    const orgName = genRandomString();
    const res0 = await service.read.get_org_info(orgName);
    expect(Number(res0.code)).toBe(0x67);
    expect(res0.errorMessage).toBe('Kyc org '+ orgName + ' not found');

    const res01 = await service.read.get_orgs();
    expect(Number(res01.code)).toBe(0);
    expect(res01.succeedData.indexOf(orgName)).toBe(-1);

    // register org
    const description = genRandomString('d', 50);
    const supportedTags = genRandomStrings(1, 'r', 12);
    const res1 = await service.write.register_org({
      name: orgName,
      description,
      admin: account.address,
      supported_tags: supportedTags,
    });
    expect(Number(res1.response.response.code)).toBe(0);
    expect(Number(res1.cyclesUsed)).toBe(basic_fee + (12 + 50 + 20) * 1000 + 10000);
    const data1 = JSON.parse(res1.events[0].data);
    expect(data1.name).toBe(orgName);
    expect(JSON.stringify(data1.supported_tags)).toBe(JSON.stringify(supportedTags));

    // check infos
    const res10 = await service.read.get_org_info(orgName);
    expect(Number(res10.code)).toBe(0);
    expect(res10.succeedData.name).toBe(orgName);
    expect(res10.succeedData.description).toBe(description);
    expect(res10.succeedData.admin).toBe(account.address);
    expect(JSON.stringify(res10.succeedData.supported_tags)).toBe(JSON.stringify(supportedTags));
    expect(res10.succeedData.approved).toBe(false);

    const res11 = await service.read.get_orgs();
    expect(Number(res11.code)).toBe(0);
    expect(res11.succeedData.indexOf(orgName)).not.toBe(-1);

    const res12 = await service.read.get_org_supported_tags(orgName);
    expect(Number(res12.code)).toBe(0);
    expect(JSON.stringify(res12.succeedData)).toBe(JSON.stringify(supportedTags));
  });

  test('test change_org_approved', async () => {
    // register org
    const service = new KycService(client, account);
    const orgName = genRandomString();
    const description = genRandomString('d', 50);
    const supportedTags = genRandomStrings();
    const res1 = await service.write.register_org({
      name: orgName,
      description,
      admin: account.address,
      supported_tags: supportedTags,
    });
    expect(Number(res1.response.response.code)).toBe(0);

    // approve
    const res2 = await service.write.change_org_approved({
      org_name: orgName,
      approved: true,
    });
    expect(Number(res2.response.response.code)).toBe(0);
    expect(Number(res2.cyclesUsed)).toBe(basic_fee);
    const data2 = JSON.parse(res2.events[0].data);
    expect(data2.org_name).toBe(orgName);
    expect(data2.approved).toBe(true);

    // disapprove
    const res3 = await service.write.change_org_approved({
      org_name: orgName,
      approved: false,
    });
    expect(Number(res3.response.response.code)).toBe(0);
    expect(Number(res3.cyclesUsed)).toBe(basic_fee);
    const data3 = JSON.parse(res3.events[0].data);
    expect(data3.org_name).toBe(orgName);
    expect(data3.approved).toBe(false);
  });

  test('test update_supported_tags', async () => {
    // register org
    const service = new KycService(client, account);
    const orgName = genRandomString();
    const description = genRandomString('d', 50);
    const supportedTags = genRandomStrings();
    const res1 = await service.write.register_org({
      name: orgName,
      description,
      admin: account.address,
      supported_tags: supportedTags,
    });
    expect(Number(res1.response.response.code)).toBe(0);

    // update supported tags
    const newSupportedTags = genRandomStrings();
    const res2 = await service.write.update_supported_tags({
      org_name: orgName,
      supported_tags: newSupportedTags,
    });
    expect(Number(res2.response.response.code)).toBe(0);
    expect(Number(res2.cyclesUsed)).toBe(basic_fee + 3 * 10000);
    const data2 = JSON.parse(res2.events[0].data);
    expect(data2.org_name).toBe(orgName);
    expect(JSON.stringify(data2.supported_tags)).toBe(JSON.stringify(newSupportedTags));
  });

  test('test update_user_tags', async () => {
    // register org
    const service = new KycService(client, account);
    const orgName = genRandomString();
    const description = genRandomString('d', 50);
    const supportedTags = genRandomStrings();
    const res1 = await service.write.register_org({
      name: orgName,
      description,
      admin: account.address,
      supported_tags: supportedTags,
    });
    expect(Number(res1.response.response.code)).toBe(0);

    // update user tags before approved
    const user = '0xcff1002107105460941f797828f468667aa1a2db';
    let tags = <Record<string, Array<string>>>{};
    supportedTags.map(tag => {
      tags[tag] = genRandomStrings();
    });

    const res2 = await service.write.update_user_tags({
      org_name: orgName,
      user,
      tags,
    });
    expect(Number(res2.response.response.code)).toBe(0x6c);
    expect(Number(res2.cyclesUsed)).toBe(basic_fee);
    expect(res2.response.response.errorMessage).toBe('Unapproved org');

    // approve
    const res3 = await service.write.change_org_approved({
      org_name: orgName,
      approved: true,
    });
    expect(Number(res3.response.response.code)).toBe(0);

    // update user tags after approved
    const res4 = await service.write.update_user_tags({
      org_name: orgName,
      user: "0xcff1002107105460941f797828f468667aa1a2db",
      tags,
    });
    expect(Number(res4.response.response.code)).toBe(0);
    expect(Number(res4.cyclesUsed)).toBe(basic_fee + 12 * 10000);
    const data4 = JSON.parse(res4.events[0].data);
    expect(data4.org_name).toBe(orgName);
    expect(data4.user).toBe(user);
    expect(data4.tags.length).toBe(tags.length);
    for (const k in data4.tags) {
      expect(JSON.stringify(data4.tags[k])).toBe(JSON.stringify(tags[k]));
    }

    // check user_tags
    const res5 = await service.read.get_user_tags({
      org_name: orgName,
      user,
    });
    expect(Number(res5.code)).toBe(0);
    expect(res5.succeedData.length).toBe(tags.length);
    for (const k in res5.succeedData) {
      expect(JSON.stringify(res5.succeedData[k])).toBe(JSON.stringify(tags[k]));
    }
  });

  test('test change_service_admin', async () => {
    // register org
    const service = new KycService(client, account);
    const orgName = genRandomString();
    const description = genRandomString('d', 50);
    const supportedTags = genRandomStrings();
    const res0 = await service.write.register_org({
      name: orgName,
      description,
      admin: account.address,
      supported_tags: supportedTags,
    });
    expect(Number(res0.response.response.code)).toBe(0);

    // create new account and transfer coins
    const newAccount = Account.fromPrivateKey(
      '0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f',
    );
    const assetService = new AssetService(client, account);
    const res1 = await assetService.write.transfer({
      asset_id: '0xf56924db538e77bb5951eb5ff0d02b88983c49c45eea30e8ae3e7234b311436c',
      to: newAccount.address,
      value: 99999999999,
      memo: 'test',
    });
    expect(Number(res1.response.response.code)).toBe(0);

    // before change, check change_org_approved, change_service_admin, register_org, update_supported_tags
    const newService = new KycService(client, newAccount);
    const newOrgName = genRandomString();
    const res2 = await newService.write.register_org({
      name: newOrgName,
      description,
      admin: newAccount.address,
      supported_tags: supportedTags,
    });
    expect(Number(res2.response.response.code)).toBe(0x68);
    expect(Number(res2.cyclesUsed)).toBe(basic_fee);
    expect(res2.response.response.errorMessage).toBe('Non authorized');

    const res3 = await newService.write.change_org_approved({
      org_name: orgName,
      approved: true,
    });
    expect(Number(res3.response.response.code)).toBe(0x68);
    expect(Number(res3.cyclesUsed)).toBe(basic_fee);
    expect(res3.response.response.errorMessage).toBe('Non authorized');

    const newSupportedTags = genRandomStrings();
    const res4 = await newService.write.update_supported_tags({
      org_name: orgName,
      supported_tags: newSupportedTags,
    });
    expect(Number(res4.response.response.code)).toBe(0x68);
    expect(Number(res4.cyclesUsed)).toBe(basic_fee);
    expect(res4.response.response.errorMessage).toBe('Non authorized');

    const res5 = await newService.write.change_service_admin({
        new_admin: newAccount.address
    });
    expect(Number(res5.response.response.code)).toBe(0x68);
    expect(Number(res5.cyclesUsed)).toBe(basic_fee);
    expect(res5.response.response.errorMessage).toBe('Non authorized');

    // change_service_admin
    const res6 = await service.write.change_service_admin({
      new_admin: newAccount.address
    });
    expect(Number(res6.response.response.code)).toBe(0);
    expect(Number(res6.cyclesUsed)).toBe(basic_fee);

    // recheck
    const res7 = await newService.write.register_org({
      name: newOrgName,
      description,
      admin: newAccount.address,
      supported_tags: supportedTags,
    });
    expect(Number(res7.response.response.code)).toBe(0);

    const res8 = await newService.write.change_org_approved({
      org_name: orgName,
      approved: true,
    });
    expect(Number(res8.response.response.code)).toBe(0);

    const res9 = await newService.write.update_supported_tags({
      org_name: orgName,
      supported_tags: newSupportedTags,
    });
    expect(Number(res9.response.response.code)).toBe(0);

    const res10 = await newService.write.change_service_admin({
      new_admin: account.address
    });
    expect(Number(res10.response.response.code)).toBe(0);
  });

  test('test change_org_admin', async () => {
    // register org and approve
    const service = new KycService(client, account);
    const orgName = genRandomString();
    const description = genRandomString('d', 50);
    const supportedTags = genRandomStrings();
    const res0 = await service.write.register_org({
      name: orgName,
      description,
      admin: account.address,
      supported_tags: supportedTags,
    });
    expect(Number(res0.response.response.code)).toBe(0);

    const res1 = await service.write.change_org_approved({
      org_name: orgName,
      approved: true,
    });
    expect(Number(res1.response.response.code)).toBe(0);

    // create new account and transfer coins
    const newAccount = Account.fromPrivateKey(
      '0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f',
    );
    const assetService = new AssetService(client, account);
    const res2 = await assetService.write.transfer({
      asset_id: '0xf56924db538e77bb5951eb5ff0d02b88983c49c45eea30e8ae3e7234b311436c',
      to: newAccount.address,
      value: 99999999,
      memo: 'test',
    });
    expect(Number(res2.response.response.code)).toBe(0);

    // before update check update_user_tags, change_org_admin
    const newService = new KycService(client, newAccount);
    const res3 = await newService.write.change_org_admin({
      name: orgName,
      new_admin: newAccount.address,
    });
    expect(Number(res3.response.response.code)).toBe(0x68);
    expect(Number(res3.cyclesUsed)).toBe(basic_fee);
    expect(res3.response.response.errorMessage).toBe('Non authorized');

    let tags = <Record<string, Array<string>>>{};
    supportedTags.map(tag => {
      tags[tag] = genRandomStrings();
    });
    const res4 = await newService.write.update_user_tags({
      org_name: orgName,
      user: newAccount.address,
      tags,
    });
    expect(Number(res4.response.response.code)).toBe(0x68);
    expect(Number(res4.cyclesUsed)).toBe(basic_fee);
    expect(res4.response.response.errorMessage).toBe('Non authorized');

    // update org admin
    const res5 = await service.write.change_org_admin({
      name: orgName,
      new_admin: newAccount.address,
    });
    expect(Number(res5.response.response.code)).toBe(0x0);

    // recheck update_user_tags, change_org_admin
    const res6 = await newService.write.update_user_tags({
      org_name: orgName,
      user: newAccount.address,
      tags,
    });
    expect(Number(res6.response.response.code)).toBe(0);

    const res7 = await newService.write.change_org_admin({
      name: orgName,
      new_admin: account.address,
    });
    expect(Number(res7.response.response.code)).toBe(0);
  });

  // test eval_user_tag_expression
  test('test eval_user_tag_expression', async () => {
    // register org
    const service = new KycService(client, account);
    const orgName = genRandomString();
    const description = genRandomString('d', 50);
    const supportedTags = genRandomStrings();
    const res1 = await service.write.register_org({
      name: orgName,
      description,
      admin: account.address,
      supported_tags: supportedTags,
    });
    expect(Number(res1.response.response.code)).toBe(0);

    // approve
    const res2 = await service.write.change_org_approved({
      org_name: orgName,
      approved: true,
    });
    expect(Number(res2.response.response.code)).toBe(0);

    // update user tags after approved
    let user = "0xcff1002107105460941f797828f468667aa1a2db";
    let tags = <Record<string, Array<string>>>{};
    supportedTags.map(tag => {
      tags[tag] = genRandomStrings();
    });
    const res3 = await service.write.update_user_tags({
      org_name: orgName,
      user,
      tags,
    });
    expect(Number(res3.response.response.code)).toBe(0);

    // test basic expression
    const expression_0 = orgName + '.' + supportedTags[0] + '@`' + tags[supportedTags[0]][0] +'`';
    const res4 = await service.read.eval_user_tag_expression({
      user,
      expression: expression_0,
    });
    expect(Number(res4.code)).toBe(0);
    expect(res4.succeedData).toBe(true);

    const res5 = await service.read.eval_user_tag_expression({
      user: '0xcff1002107105661941f797828f468667aa1a2db',
      expression: expression_0,
    });
    expect(Number(res5.code)).toBe(0);
    expect(res5.succeedData).toBe(false);

    const expression_1 = orgName + '.' + supportedTags[0] + '@`' + tags[supportedTags[1]][0] +'`';
    const res6 = await service.read.eval_user_tag_expression({
      user,
      expression: expression_1,
    });
    expect(Number(res6.code)).toBe(0);
    expect(res6.succeedData).toBe(false);

    // test complex expression
    const expression_2 = '(' + orgName + '.' + supportedTags[0] + '@`' + tags[supportedTags[0]][0]
      + '` || ' + orgName + '.' + supportedTags[1] + '@`' + tags[supportedTags[0]][0] + '`) && '
      + orgName + '.' + supportedTags[2] + '@`' + tags[supportedTags[2]][2] + '`';
    const res7 = await service.read.eval_user_tag_expression({
      user,
      expression: expression_2,
    });
    expect(Number(res7.code)).toBe(0);
    expect(res7.succeedData).toBe(true);
  });
});
