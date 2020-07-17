# 手续费计算

1. 手续费支付对象：交易发起人

2. 手续费计算

$$
max(TX\_FLOOR\_FEE, \ \sum profit \times fee\_rate \times discount\_rate)
$$

其中 `TX_FLOOR_FEE` 为最低手续费金额，`fee_rate` 是手续费率，对应 Govern Service 中的 `profit_deduct_rate_per_million`，`discount_rate` 是一个手续费折扣，对应 Govern Service 中的 `tx_fee_discount`，其与交易发起人的账户余额有关，关系见下表：

|    账户余额     | 折扣 |
| :-------------: | :--: |
|    [0, 1000)    |  1   |
|  [1000, 10000)  | 0.9  |
| [10000, 100000) | 0.7  |
|  [100000, +∞)   | 0.5  |
