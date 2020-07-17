# Governance Service

## 概述

Governance Service 负责节点的共识配置以及权限的管理（metadata）和手续费计费以及矿工费的支付。

Governance Service 对共识配置的管理通过更改 [metadata](./metadata_service.md) 进行。metadata 中包括共识列表，出块时间，共识每阶段的超时配置，`cycle_limit`，`cycle_price`，每个块中的最大交易数等等。

在每一笔交易链路中，每当执行过程中产生利润，都要在 Governance Service 中进行利润申报，当每一笔交易执行完成后，Governance Service 会根据交易发起人账户余额和所有利润之和计算手续费金额并进行扣费。当每一个区块包含的所有的交易执行完成后，会向出块人的账户支付矿工费。

## 接口

1. 读取 admin 地址

```rust
fn get_admin(&self, ctx: ServiceContext) -> ProtocolResult<Address>;
```

GraphiQL 示例：

```graphql
query get_admin{
  queryService(
  caller: "0x016cbd9ee47a255a6f68882918dcdd9e14e6bee1"
  serviceName: "governance"
  method: "get_admin"
  payload: ""
  ){
    ret,
    isError
  }
}
```

2. 设置 admin 地址

```rust
// 需要 admin 权限
fn set_admin(&mut self, ctx: ServiceContext, payload: SetAdminPayload) -> ProtocolResult<()>;

// 参数
pub struct SetAdminPayload {
    pub admin: Address,
}
```

GraphiQL 示例：

```graphql
mutation set_admin{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"set_admin",
    payload:"{\"admin\": \"0x016cbd9ee47a255a6f68882918dcdd9e14e6bee1\"}",
    timeout:"0x14",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f"
  )
}
```

3. 更新元数据
   
```rust
// 需要 admin 权限
fn update_metadata(&mut self, ctx: ServiceContext, payload: UpdateMetadataPayload) -> ProtocolResult<()>;

// 参数
pub struct UpdateMetadataPayload {
    pub verifier_list:   Vec<ValidatorExtend>,
    pub interval:        u64,
    pub propose_ratio:   u64,
    pub prevote_ratio:   u64,
    pub precommit_ratio: u64,
    pub brake_ratio:  u64
}

pub struct ValidatorExtend {
    pub bls_pub_key: String,
    pub address:        Address,
    pub propose_weight: u32,
    pub vote_weight:    u32,
}
```

GraphiQL 示例：

```graphql
mutation update_metadata{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"update_metadata",
    payload:"{\"verifier_list\": [{\"bls_pub_key\": \"0x04188ef9488c19458a963cc57b567adde7db8f8b6bec392d5cb7b67b0abc1ed6cd966edc451f6ac2ef38079460eb965e890d1f576e4039a20467820237cda753f07a8b8febae1ec052190973a1bcf00690ea8fc0168b3fbbccd1c4e402eda5ef22\", \"address\": \"0xf8389d774afdad8755ef8e629e5a154fddc6325a\", \"propose_weight\": 5, \"vote_weight\": 5}], \"interval\": 5000, \"propose_ratio\": 5, \"prevote_ratio\": 5, \"precommit_ratio\": 5, \"brake_ratio\": 5}",
    timeout:"0xbe",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x30269d47fcf602b889243722b666881bf953f1213228363d34cf04ddcd51dfd2"
  )
}
```

4. 更新区块间隔

```rust
// 需要 admin 权限
fn update_interval(&mut self, ctx: ServiceContext, payload: UpdateIntervalPayload) -> ProtocolResult<()>;

// 参数
pub struct UpdateIntervalPayload {
    pub interval: u64,
}
```

GraphiQL 示例：

```graphql
mutation update_interval{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"update_interval",
    payload:"{\"interval\": 666}",
    timeout:"0x20",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x45c56be699dca666191ad3446897e0f480da234da896270202514a0e1a587c3f"
  )
}
```

5. 更新验证人集合

```rust
// 需要 admin 权限
fn update_validators(&mut self, ctx: ServiceContext, payload: UpdateValidatorsPayload) -> ProtocolResult<()>;

// 参数
pub struct UpdateValidatorsPayload {
    pub verifier_list: Vec<ValidatorExtend>,
}

pub struct ValidatorExtend {
    pub bls_pub_key: String,
    pub address:        Address,
    pub propose_weight: u32,
    pub vote_weight:    u32,
}
```

GraphiQL 示例：

```graphql
mutation update_validators{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"update_validators",
    payload:"{\"verifier_list\": [{\"bls_pub_key\": \"0x04188ef9488c19458a963cc57b567adde7db8f8b6bec392d5cb7b67b0abc1ed6cd966edc451f6ac2ef38079460eb965e890d1f576e4039a20467820237cda753f07a8b8febae1ec052190973a1bcf00690ea8fc0168b3fbbccd1c4e402eda5ef22\", \"address\": \"0x016cbd9ee47a255a6f68882918dcdd9e14e6bee1\", \"propose_weight\": 5, \"vote_weight\": 5}]}",
    timeout:"0xbe",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x30269d47fcf602b889243722b666881bf953f1213228363d34cf04ddcd51dfd2"
  )
}
```

6. 更新共识 round 超时时间

```rust
// 需要 admin 权限
fn update_ratio(&mut self, ctx: ServiceContext, payload: UpdateRatioPayload) -> ProtocolResult<()>;

// 参数
pub struct UpdateRatioPayload {
    pub propose_ratio:   u64,
    pub prevote_ratio:   u64,
    pub precommit_ratio: u64,
    pub brake_ratio: u64
}
```

GraphiQL 示例：

```graphql
mutation update_ratio{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"update_ratio",
    payload:"{\"propose_ratio\": 5, \"prevote_ratio\": 5, \"precommit_ratio\": 5, \"brake_ratio\": 5}",
    timeout:"0xbe",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x30269d47fcf602b889243722b666881bf953f1213228363d34cf04ddcd51dfd2"
  )
}
```

7. 获取治理信息

```rust
fn get_govern_info(&self, ctx: ServiceContext) -> ServiceResponse<GovernanceInfo>;

// 参数
pub struct GovernanceInfo {
    pub admin: Address,
    pub tx_failure_fee: u64,
    pub tx_floor_fee: u64,
    pub profit_deduct_rate_per_million: u64,
    pub tx_fee_discount: Vec<DiscountLevel>,
    pub miner_benefit: u64,
}
```

GraphiQL 示例：

```graphql
query get_govern_info {
  queryService(
  caller: "0x016cbd9ee47a255a6f68882918dcdd9e14e6bee1"
  serviceName: "governance"
  method: "get_govern_info"
  payload: ""
  ){
    ret,
    isError
  }
}
```

8. 设置治理信息

```rust
// 需要 admin 权限
fn set_govern_info(&mut self, ctx: ServiceContext, payload: SetGovernInfoPayload) -> ServiceResponse<()>;

// 参数
pub struct SetGovernInfoPayload {
    pub inner: GovernanceInfo,
}

pub struct GovernanceInfo {
    pub admin: Address,
    pub tx_failure_fee: u64,
    pub tx_floor_fee: u64,
    pub profit_deduct_rate_per_million: u64,
    pub tx_fee_discount: Vec<DiscountLevel>,
    pub miner_benefit: u64,
}
```

GraphiQL 示例：

```graphql
mutation update_validators{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"update_validators",
    payload:"{\"admin\":\"0xf8389d774afdad8755ef8e629e5a154fddc6325a\",
  	\"tx_failure_fee\":100,
  	\"tx_floor_fee\":200,
  	\"profit_deduct_rate_per_million\":3,
  	\"tx_fee_discount\":[{\"threshold\":1000,\"discount_percent\":90},
  	{\"threshold\":10000,\"discount_percent\":70},
  	{\"threshold\":100000,\"discount_percent\":50}],
  	\"miner_benefit\":10000}",
    timeout:"0xbe",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x30269d47fcf602b889243722b666881bf953f1213228363d34cf04ddcd51dfd2"
  )
}
```

9. 获取交易失败手续费

```rust
fn get_tx_failure_fee(&self, ctx: ServiceContext) -> ServiceResponse<u64>;
```

GraphiQL 示例：

```graphql
query get_tx_failure_fee {
  queryService(
  caller: "0x016cbd9ee47a255a6f68882918dcdd9e14e6bee1"
  serviceName: "governance"
  method: "get_tx_failure_fee"
  payload: ""
  ){
    ret,
    isError
  }
}
```

10. 获取最低手续费

```rust
fn get_tx_floor_fee(&self, ctx: ServiceContext) -> ServiceResponse<u64>;
```

GraphiQL 示例：

```graphql
query get_tx_floor_fee{
  queryService(
  caller: "0x016cbd9ee47a255a6f68882918dcdd9e14e6bee1"
  serviceName: "governance"
  method: "get_tx_floor_fee"
  payload: ""
  ){
    ret,
    isError
  }
}
```

11. 设置矿工收款地址

```rust
// 需要 admin 权限
fn set_miner(&mut self, ctx: ServiceContext, payload: MinerChargeConfig) -> ServiceResponse<()>;

// 参数
pub struct MinerChargeConfig {
    // 矿工地址
    pub address:              Address,
    // 矿工收款地址
    pub miner_charge_address: Address,
}
```

GraphiQL 示例：

```graphql
mutation update_validators{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"update_validators",
    payload:"{\"address\":\"0x755cdba6ae4f479f7164792b318b2a06c759833b\",
    \"miner_charge_address\":\"0xf8389d774afdad8755ef8e629e5a154fddc6325a\"}",
    timeout:"0xbe",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x30269d47fcf602b889243722b666881bf953f1213228363d34cf04ddcd51dfd2"
  )
}
```

12. 申报利润

```rust
fn accumulate_profit(&mut self, ctx: ServiceContext, payload: AccmulateProfitPayload) -> ServiceResponse<()>;

// 参数
pub struct AccmulateProfitPayload {
    // 获得利润的地址
    pub address:            Address,
    // 获得的利润
    pub accumulated_profit: u64,
}
```

GraphiQL 示例：

```graphql
mutation update_validators{
  unsafeSendTransaction(inputRaw: {
    serviceName:"governance",
    method:"accumulate_profit",
    payload:"{\"address\":\"0x755cdba6ae4f479f7164792b318b2a06c759833b\",
    \"accumulated_profit\":1000000}",
    timeout:"0xbe",
    nonce:"0x9db2d7efe2b61a28827e4836e2775d913a442ed2f9096ca1233e479607c27cf7",
    chainId:"0xb6a4d7da21443f5e816e8700eea87610e6d769657d6b8ec73028457bf2ca4036",
    cyclesPrice:"0x9999",
    cyclesLimit:"0x9999",
    }, inputPrivkey: "0x30269d47fcf602b889243722b666881bf953f1213228363d34cf04ddcd51dfd2"
  )
}
```

交易手续费的扣除会在每一笔交易执行结束之后自动进行，矿工费的支付会在每一个区块的交易全部执行结束之后进行。具体的交易手续费的计算规则参见[手续费计算](./calc_fee.md)。
