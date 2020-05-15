#![no_std]
#![no_main]

extern crate alloc;

use alloc::format;

use contract::{
    contract_api::{account, runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use types::{account::PublicKey, ApiError, Key, URef, U512};

const TRANSFER_RESULT_UREF_NAME: &str = "transfer_result";
const MAIN_PURSE_FINAL_BALANCE_UREF_NAME: &str = "final_balance";

const ARG_TARGET: &str = "target";
const ARG_AMOUNT: &str = "amount";

#[no_mangle]
pub extern "C" fn call() {
    let source: URef = account::get_main_purse();
    let target: PublicKey = runtime::get_named_arg(ARG_TARGET);
    let amount: U512 = runtime::get_named_arg(ARG_AMOUNT);

    let transfer_result = system::transfer_from_purse_to_account(source, target, amount);

    let final_balance = system::get_balance(source).unwrap_or_revert_with(ApiError::User(103));

    let result = format!("{:?}", transfer_result);

    let result_uref: Key = storage::new_uref(result).into();
    runtime::put_key(TRANSFER_RESULT_UREF_NAME, result_uref);
    runtime::put_key(
        MAIN_PURSE_FINAL_BALANCE_UREF_NAME,
        storage::new_uref(final_balance).into(),
    );
}
