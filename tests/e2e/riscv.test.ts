/* eslint-env node, jest */
import { readFileSync } from 'fs';
import { Address } from '@mutadev/types';
import { InterpreterType, RISCVService } from 'huobi-chain-sdk';
import { admin, client } from './utils';

const riscvService = new RISCVService(client, admin);

async function deploy(code: string, initArgs: string) {
  const res0 = await riscvService.write.deploy({
    code,
    intp_type: InterpreterType.Binary,
    init_args: initArgs,
  });
  console.log(res0);
  expect(Number(res0.response.response.code)).toBe(0);
}

async function check_deploy_auth(address: Address) {
  const res0 = await riscvService.read.check_deploy_auth({
    addresses: [ address ],
  });
  console.log(res0);
}

async function grant_deploy_auth(address: Address) {
  const res0 = await riscvService.write.grant_deploy_auth({
    addresses: [ address ],
  });
  console.log(res0);
}

describe('riscv service', () => {
  test('test_riscv_deploy_auth', async () => {
    await check_deploy_auth(admin.address);
    await grant_deploy_auth(admin.address);
    await check_deploy_auth(admin.address);

    const code = readFileSync('../../services/riscv/src/tests/simple_storage');
//     console.log(code.toString('hex'));
    await deploy(code.toString('hex'), 'set k init');
  });
});
