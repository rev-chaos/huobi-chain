#[cfg(test)]
mod tests;
pub mod types;

use std::ops::{Deref, DerefMut};

use bytes::Bytes;
use derive_more::Display;
use serde::Serialize;

use crate::types::{
    ApproveEvent, ApprovePayload, Asset, AssetBalance, BurnAssetEvent, BurnAssetPayload,
    ChangeAdminPayload, CreateAssetPayload, GetAllowancePayload, GetAllowanceResponse,
    GetAssetPayload, GetBalancePayload, GetBalanceResponse, HookTransferFromPayload,
    InitGenesisPayload, MintAssetEvent, MintAssetPayload, RelayAssetEvent, RelayAssetPayload,
    TransferEvent, TransferFromEvent, TransferFromPayload, TransferPayload,
};
use binding_macro::{cycles, genesis, service, write};
use protocol::traits::{ExecutorParams, ServiceResponse, ServiceSDK, StoreMap};
use protocol::types::{Address, Hash, ServiceContext};

const NATIVE_ASSET_KEY: &str = "native_asset";
pub const ASSET_SERVICE_NAME: &str = "asset";

macro_rules! get_asset_require_admin {
    ($sdk:expr, $ctx:expr, $id: expr) => {{
        let asset = if let Some(asset_info) = $sdk.get($id) {
            asset_info.clone()
        } else {
            return ServiceError::AssetNotFound($id.clone()).into();
        };

        if asset.admin != $ctx.get_caller() {
            return ServiceError::Unauthorized.into();
        }
        asset
    }};
}

macro_rules! require_asset_exists {
    ($service:expr, $asset_id:expr) => {
        if !$service.assets.contains(&$asset_id) {
            return ServiceError::AssetNotFound($asset_id).into();
        }
    };
}

macro_rules! get_native_asset {
    ($service:expr) => {{
        let res = $service
            .sdk
            .get_value::<_, Hash>(&NATIVE_ASSET_KEY.to_owned());
        if res.is_none() {
            return ServiceError::NoNativeAsset.into();
        }
        res.unwrap()
    }};
}

macro_rules! impl_assets {
    ($self: expr, $method: ident, $ctx: expr) => {{
        let res = $self.$method($ctx.clone());
        if res.is_error() {
            Err(ServiceResponse::from_error(res.code, res.error_message))
        } else {
            Ok(res.succeed_data)
        }
    }};
    ($self: expr, $method: ident, $ctx: expr, $payload: expr) => {{
        let res = $self.$method($ctx.clone(), $payload);
        if res.is_error() {
            Err(ServiceResponse::from_error(res.code, res.error_message))
        } else {
            Ok(res.succeed_data)
        }
    }};
}

macro_rules! verify_payload {
    ($payload: ident) => {
        if let Err(err) = $payload.verify() {
            return err.into();
        }
    };
}

pub trait AssetInterface {
    fn native_asset(&self, ctx: &ServiceContext) -> Result<Asset, ServiceResponse<()>>;

    fn balance(
        &self,
        ctx: &ServiceContext,
        payload: GetBalancePayload,
    ) -> Result<GetBalanceResponse, ServiceResponse<()>>;

    fn transfer_(
        &mut self,
        ctx: &ServiceContext,
        payload: TransferPayload,
    ) -> Result<(), ServiceResponse<()>>;

    fn transfer_from_(
        &mut self,
        ctx: &ServiceContext,
        payload: TransferFromPayload,
    ) -> Result<(), ServiceResponse<()>>;

    fn hook_transfer_from_(
        &mut self,
        ctx: &ServiceContext,
        payload: HookTransferFromPayload,
    ) -> Result<(), ServiceResponse<()>>;

    fn approve_(
        &mut self,
        ctx: &ServiceContext,
        payload: ApprovePayload,
    ) -> Result<(), ServiceResponse<()>>;

    fn burn_(
        &mut self,
        ctx: &ServiceContext,
        payload: BurnAssetPayload,
    ) -> Result<(), ServiceResponse<()>>;

    fn relay_(
        &mut self,
        ctx: &ServiceContext,
        payload: RelayAssetPayload,
    ) -> Result<(), ServiceResponse<()>>;
}

pub struct AssetService<SDK> {
    sdk:    SDK,
    assets: Box<dyn StoreMap<Hash, Asset>>,
}

impl<SDK: ServiceSDK> Deref for AssetService<SDK> {
    type Target = SDK;

    fn deref(&self) -> &Self::Target {
        &self.sdk
    }
}

impl<SDK: ServiceSDK> DerefMut for AssetService<SDK> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.sdk
    }
}

impl<SDK: ServiceSDK> AssetInterface for AssetService<SDK> {
    fn native_asset(&self, ctx: &ServiceContext) -> Result<Asset, ServiceResponse<()>> {
        impl_assets!(self, get_native_asset, ctx)
    }

    fn balance(
        &self,
        ctx: &ServiceContext,
        payload: GetBalancePayload,
    ) -> Result<GetBalanceResponse, ServiceResponse<()>> {
        impl_assets!(self, get_balance, ctx, payload)
    }

    fn transfer_(
        &mut self,
        ctx: &ServiceContext,
        payload: TransferPayload,
    ) -> Result<(), ServiceResponse<()>> {
        impl_assets!(self, transfer, ctx, payload)
    }

    fn transfer_from_(
        &mut self,
        ctx: &ServiceContext,
        payload: TransferFromPayload,
    ) -> Result<(), ServiceResponse<()>> {
        impl_assets!(self, transfer_from, ctx, payload)
    }

    fn hook_transfer_from_(
        &mut self,
        ctx: &ServiceContext,
        payload: HookTransferFromPayload,
    ) -> Result<(), ServiceResponse<()>> {
        impl_assets!(self, hook_transfer_from, ctx, payload)
    }

    fn approve_(
        &mut self,
        ctx: &ServiceContext,
        payload: ApprovePayload,
    ) -> Result<(), ServiceResponse<()>> {
        impl_assets!(self, approve, ctx, payload)
    }

    fn burn_(
        &mut self,
        ctx: &ServiceContext,
        payload: BurnAssetPayload,
    ) -> Result<(), ServiceResponse<()>> {
        impl_assets!(self, burn, ctx, payload)
    }

    fn relay_(
        &mut self,
        ctx: &ServiceContext,
        payload: RelayAssetPayload,
    ) -> Result<(), ServiceResponse<()>> {
        impl_assets!(self, relay, ctx, payload)
    }
}

#[service]
impl<SDK: ServiceSDK> AssetService<SDK> {
    pub fn new(mut sdk: SDK) -> Self {
        let assets: Box<dyn StoreMap<Hash, Asset>> = sdk.alloc_or_recover_map("assets");

        Self { sdk, assets }
    }

    #[genesis]
    fn init_genesis(&mut self, payload: InitGenesisPayload) {
        if let Err(e) = payload.verify() {
            panic!(e);
        }

        let asset = Asset {
            id:        payload.id.clone(),
            name:      payload.name,
            symbol:    payload.symbol,
            admin:     payload.admin.clone(),
            supply:    payload.supply,
            precision: payload.precision,
            relayable: payload.relayable,
        };

        self.set_asset_(asset.clone());
        self.set_value(NATIVE_ASSET_KEY.to_owned(), payload.id.clone());

        for mint in payload.init_mints {
            self.set_account_value(
                &mint.addr,
                asset.id.clone(),
                AssetBalance::new(mint.balance),
            )
        }
    }

    #[cycles(100_00)]
    #[read]
    fn get_native_asset(&self, _ctx: ServiceContext) -> ServiceResponse<Asset> {
        let asset_id = get_native_asset!(self);

        self.read_asset_(&asset_id)
            .map(ServiceResponse::from_succeed)
            .unwrap_or_else(|| ServiceError::AssetNotFound(asset_id).into())
    }

    #[cycles(100_00)]
    #[read]
    fn get_asset(&self, _ctx: ServiceContext, payload: GetAssetPayload) -> ServiceResponse<Asset> {
        verify_payload!(payload);

        match self.read_asset_(&payload.id) {
            Some(s) => ServiceResponse::from_succeed(s),
            None => ServiceError::AssetNotFound(payload.id).into(),
        }
    }

    #[cycles(10_000)]
    #[read]
    fn get_admin(&self, ctx: ServiceContext, asset_id: Hash) -> ServiceResponse<Address> {
        if let Some(asset) = self.assets.get(&asset_id) {
            ServiceResponse::from_succeed(asset.admin)
        } else {
            ServiceError::AssetNotFound(asset_id).into()
        }
    }

    #[cycles(100_00)]
    #[read]
    fn get_balance(
        &self,
        _ctx: ServiceContext,
        payload: GetBalancePayload,
    ) -> ServiceResponse<GetBalanceResponse> {
        verify_payload!(payload);
        require_asset_exists!(self, payload.asset_id);

        let user_balance = self.asset_balance(&payload.user, &payload.asset_id);

        ServiceResponse::from_succeed(GetBalanceResponse {
            asset_id: payload.asset_id,
            user:     payload.user,
            balance:  *user_balance,
        })
    }

    #[cycles(100_00)]
    #[read]
    fn get_allowance(
        &self,
        _ctx: ServiceContext,
        payload: GetAllowancePayload,
    ) -> ServiceResponse<GetAllowanceResponse> {
        verify_payload!(payload);
        require_asset_exists!(self, payload.asset_id);

        let grantor_balance = self.asset_balance(&payload.grantor, &payload.asset_id);
        let grantee_allowance = grantor_balance.allowance(&payload.grantee);

        ServiceResponse::from_succeed(GetAllowanceResponse {
            asset_id: payload.asset_id,
            grantor:  payload.grantor,
            grantee:  payload.grantee,
            value:    grantee_allowance,
        })
    }

    #[cycles(210_00)]
    #[write]
    fn create_asset(
        &mut self,
        ctx: ServiceContext,
        payload: CreateAssetPayload,
    ) -> ServiceResponse<Asset> {
        verify_payload!(payload);

        let caller = ctx.get_caller();
        let payload_json = match serde_json::to_string(&payload) {
            Ok(j) => j,
            Err(err) => return ServiceError::JsonParse(err).into(),
        };

        let asset_id = Hash::digest(Bytes::from(payload_json + &caller.to_string()));
        if self.assets.contains(&asset_id) {
            return ServiceError::Exists(asset_id).into();
        }

        let asset = Asset {
            id:        asset_id,
            name:      payload.name,
            symbol:    payload.symbol,
            admin:     payload.admin,
            supply:    payload.supply,
            precision: payload.precision,
            relayable: payload.relayable,
        };

        self.set_asset_(asset.clone());
        for mint in payload.init_mints {
            self.set_account_value(
                &mint.addr,
                asset.id.clone(),
                AssetBalance::new(mint.balance),
            )
        }

        Self::emit_event(&ctx, "CreateAsset".to_owned(), &asset);
        ServiceResponse::from_succeed(asset)
    }

    #[cycles(210_00)]
    #[write]
    fn transfer(&mut self, ctx: ServiceContext, payload: TransferPayload) -> ServiceResponse<()> {
        verify_payload!(payload);
        require_asset_exists!(self, payload.asset_id);

        let sender = match Self::extra_caller(&ctx) {
            Ok(s) => s,
            Err(err) => return err.into(),
        };

        let asset_id = payload.asset_id;
        if let Err(err) = self._transfer(&sender, &payload.to, asset_id.clone(), payload.value) {
            return err.into();
        }

        let event = TransferEvent {
            asset_id,
            from: sender,
            to: payload.to,
            value: payload.value,
            memo: payload.memo,
        };
        Self::emit_event(&ctx, "TransferAsset".to_owned(), event)
    }

    #[cycles(210_00)]
    #[write]
    fn transfer_from(
        &mut self,
        ctx: ServiceContext,
        payload: TransferFromPayload,
    ) -> ServiceResponse<()> {
        verify_payload!(payload);
        require_asset_exists!(self, payload.asset_id);

        let caller = match Self::extra_caller(&ctx) {
            Ok(s) => s,
            Err(err) => return err.into(),
        };

        let asset_id = &payload.asset_id;
        let mut sender_balance = self.asset_balance(&payload.sender, &asset_id);

        let caller_allowance = sender_balance.allowance(&caller);
        if caller_allowance < payload.value {
            return ServiceError::LackOfBalance {
                expect: payload.value,
                real:   caller_allowance,
            }
            .into();
        }

        let (checked_allowance, overflow) = caller_allowance.overflowing_sub(payload.value);
        if overflow {
            return ServiceError::BalanceOverflow.into();
        }

        sender_balance.update_allowance(caller.clone(), checked_allowance);
        self.set_account_value(&payload.sender, asset_id.to_owned(), sender_balance);

        if let Err(err) = self._transfer(
            &payload.sender,
            &payload.recipient,
            asset_id.to_owned(),
            payload.value,
        ) {
            return err.into();
        }

        let event = TransferFromEvent {
            asset_id: payload.asset_id,
            caller,
            sender: payload.sender,
            recipient: payload.recipient,
            value: payload.value,
            memo: payload.memo,
        };
        Self::emit_event(&ctx, "TransferFrom".to_owned(), event)
    }

    #[write]
    fn hook_transfer_from(
        &mut self,
        ctx: ServiceContext,
        payload: HookTransferFromPayload,
    ) -> ServiceResponse<()> {
        verify_payload!(payload);

        if let Some(admin_key) = ctx.get_extra() {
            if admin_key != Bytes::from_static(b"governance") {
                return ServiceError::Unauthorized.into();
            }
        }

        let asset_id = get_native_asset!(self);
        if let Err(err) =
            self._transfer(&payload.sender, &payload.recipient, asset_id, payload.value)
        {
            return err.into();
        }

        ServiceResponse::from_succeed(())
    }

    #[cycles(210_00)]
    #[write]
    fn approve(&mut self, ctx: ServiceContext, payload: ApprovePayload) -> ServiceResponse<()> {
        verify_payload!(payload);
        require_asset_exists!(self, payload.asset_id);

        let caller = ctx.get_caller();
        if caller == payload.to {
            return ServiceError::ApproveToSelf.into();
        }

        let asset_id = &payload.asset_id;
        let mut caller_balance = self.asset_balance(&caller, &asset_id);

        caller_balance.update_allowance(payload.to.clone(), payload.value);
        self.set_account_value(&caller, asset_id.to_owned(), caller_balance);

        let event = ApproveEvent {
            asset_id: payload.asset_id,
            grantor:  caller,
            grantee:  payload.to,
            value:    payload.value,
            memo:     payload.memo,
        };
        Self::emit_event(&ctx, "ApproveAsset".to_owned(), event)
    }

    #[cycles(210_00)]
    #[write]
    fn change_admin(
        &mut self,
        ctx: ServiceContext,
        payload: ChangeAdminPayload,
    ) -> ServiceResponse<()> {
        verify_payload!(payload);
        let mut asset = get_asset_require_admin!(self.assets, &ctx, &payload.asset_id);

        asset.admin = payload.new_admin.clone();
        self.set_asset_(asset);

        Self::emit_event(&ctx, "ChangeAdmin".to_owned(), payload)
    }

    #[cycles(210_00)]
    #[write]
    fn mint(&mut self, ctx: ServiceContext, payload: MintAssetPayload) -> ServiceResponse<()> {
        verify_payload!(payload);
        let mut asset = get_asset_require_admin!(self.assets, &ctx, &payload.asset_id);

        let mut recipient_balance = self.asset_balance(&payload.to, &payload.asset_id);
        if let Err(e) = recipient_balance.checked_add(payload.amount) {
            return e.into();
        }

        let (checked_value, overflow) = asset.supply.overflowing_add(payload.amount);
        if overflow {
            return ServiceError::BalanceOverflow.into();
        }
        asset.supply = checked_value;

        self.set_asset_(asset);
        self.set_account_value(&payload.to, payload.asset_id.clone(), recipient_balance);
        Self::emit_event(&ctx, "MintAsset".to_owned(), MintAssetEvent {
            asset_id: payload.asset_id,
            to:       payload.to,
            amount:   payload.amount,
            proof:    payload.proof,
            memo:     payload.memo,
        })
    }

    #[cycles(210_00)]
    #[write]
    fn burn(&mut self, ctx: ServiceContext, payload: BurnAssetPayload) -> ServiceResponse<()> {
        verify_payload!(payload);
        let mut asset = if let Some(asset) = self.read_asset_(&payload.asset_id) {
            asset
        } else {
            return ServiceError::AssetNotFound(payload.asset_id.clone()).into();
        };

        let mut burner_balance = self.asset_balance(&ctx.get_caller(), &payload.asset_id);
        if let Err(e) = burner_balance.checked_sub(payload.amount) {
            return e.into();
        }

        let (checked_value, overflow) = asset.supply.overflowing_sub(payload.amount);
        if overflow {
            return ServiceError::BalanceOverflow.into();
        }
        asset.supply = checked_value;

        self.set_asset_(asset);
        self.set_account_value(&ctx.get_caller(), payload.asset_id.clone(), burner_balance);

        Self::emit_event(&ctx, "BurnAsset".to_owned(), BurnAssetEvent {
            asset_id: payload.asset_id,
            from:     ctx.get_caller(),
            amount:   payload.amount,
            proof:    payload.proof,
            memo:     payload.memo,
        })
    }

    #[cycles(210_00)]
    #[write]
    fn relay(&mut self, ctx: ServiceContext, payload: RelayAssetPayload) -> ServiceResponse<()> {
        verify_payload!(payload);
        let asset = if let Some(asset) = self.read_asset_(&payload.asset_id) {
            asset
        } else {
            return ServiceError::AssetNotFound(payload.asset_id.clone()).into();
        };

        if !asset.relayable {
            return ServiceError::NotRelayable.into();
        }

        let resp = self.burn(ctx.clone(), payload.clone());

        if resp.is_error() {
            return resp;
        }

        Self::emit_event(&ctx, "RelayAsset".to_owned(), RelayAssetEvent {
            asset_id: payload.asset_id,
            from:     ctx.get_caller(),
            amount:   payload.amount,
            proof:    payload.proof,
            memo:     payload.memo,
        })
    }

    fn _transfer(
        &mut self,
        sender: &Address,
        recipient: &Address,
        asset_id: Hash,
        value: u64,
    ) -> Result<(), ServiceError> {
        if sender == recipient {
            return Ok(());
        }

        let mut sender_balance = self.asset_balance(sender, &asset_id);
        if sender_balance < value {
            return Err(ServiceError::LackOfBalance {
                expect: value,
                real:   sender_balance.value,
            });
        }

        sender_balance.checked_sub(value)?;
        self.set_account_value(sender, asset_id.clone(), sender_balance);

        let mut recipient_balance = self.asset_balance(recipient, &asset_id);
        recipient_balance.checked_add(value)?;
        self.set_account_value(recipient, asset_id, recipient_balance);

        Ok(())
    }

    fn asset_balance(&self, account: &Address, asset_id: &Hash) -> AssetBalance {
        self.get_account_value(account, asset_id)
            .unwrap_or_default()
    }

    fn extra_caller(ctx: &ServiceContext) -> Result<Address, ServiceError> {
        match ctx.get_extra() {
            Some(extra) => {
                let opt_str = String::from_utf8(extra.to_vec()).ok();
                let opt_addr = opt_str.map(|str| Address::from_hex(&str).ok());

                match opt_addr.flatten() {
                    Some(addr) => Ok(addr),
                    None => Err(ServiceError::NotHexCaller),
                }
            }
            None => Ok(ctx.get_caller()),
        }
    }

    fn read_asset_(&self, asset_id: &Hash) -> Option<Asset> {
        self.assets.get(asset_id)
    }

    fn set_asset_(&mut self, asset: Asset) {
        self.assets.insert(asset.id.clone(), asset);
    }

    #[cfg(test)]
    fn admin(&self, asset_id: &Hash) -> Address {
        self.assets.get(asset_id).expect("admin not found").admin
    }

    fn emit_event<T: Serialize>(
        ctx: &ServiceContext,
        name: String,
        event: T,
    ) -> ServiceResponse<()> {
        match serde_json::to_string(&event) {
            Err(err) => ServiceError::JsonParse(err).into(),
            Ok(json) => {
                ctx.emit_event(ASSET_SERVICE_NAME.to_owned(), name, json);
                ServiceResponse::from_succeed(())
            }
        }
    }
}

#[derive(Debug, Display)]
pub enum ServiceError {
    #[display(fmt = "Not found asset, id {:?}", _0)]
    AssetNotFound(Hash),

    #[display(fmt = "Lack of balance, expect {:?} real {:?}", expect, real)]
    LackOfBalance { expect: u64, real: u64 },

    #[display(fmt = "Parsing payload to json failed {:?}", _0)]
    JsonParse(serde_json::Error),

    #[display(fmt = "Asset {:?} already exists", _0)]
    Exists(Hash),

    #[display(fmt = "Fee not enough")]
    FeeNotEnough,

    #[display(fmt = "Balance overflow")]
    BalanceOverflow,

    #[display(fmt = "Approve to self")]
    ApproveToSelf,

    #[display(fmt = "Sender address is not hex")]
    NotHexCaller,

    #[display(fmt = "Unauthorized")]
    Unauthorized,

    #[display(fmt = "Asset's name or symbol format error")]
    Format,

    #[display(fmt = "Asset is not relay-able")]
    NotRelayable,

    #[display(fmt = "Can not get native asset")]
    NoNativeAsset,

    #[display(fmt = "{} is zero or empty which is meaningless", _0)]
    MeaningLessValue(String),

    #[display(fmt = "Accumulative mint value is not equals to supply")]
    MintNotEqualSupply,

    #[display(fmt = "Memo is too long")]
    TooLongMemo,
}

impl ServiceError {
    fn code(&self) -> u64 {
        match self {
            ServiceError::AssetNotFound(_) => 101,
            ServiceError::LackOfBalance { .. } => 102,
            ServiceError::JsonParse(_) => 103,
            ServiceError::Exists(_) => 104,
            ServiceError::FeeNotEnough => 105,
            ServiceError::BalanceOverflow => 106,
            ServiceError::ApproveToSelf => 107,
            ServiceError::NotHexCaller => 108,
            ServiceError::Unauthorized => 109,
            ServiceError::Format => 110,
            ServiceError::NotRelayable => 111,
            ServiceError::NoNativeAsset => 112,
            ServiceError::MeaningLessValue(_) => 113,
            ServiceError::MintNotEqualSupply => 114,
            ServiceError::TooLongMemo => 115,
        }
    }
}

impl<T: Default> From<ServiceError> for ServiceResponse<T> {
    fn from(err: ServiceError) -> ServiceResponse<T> {
        ServiceResponse::from_error(err.code(), err.to_string())
    }
}
