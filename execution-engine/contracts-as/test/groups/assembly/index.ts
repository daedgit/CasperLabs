//@ts-nocheck
import * as CL from "../../../../contract-as/assembly";
import { Error, ErrorCode } from "../../../../contract-as/assembly/error";
import { Key } from "../../../../contract-as/assembly/key";
import { URef } from "../../../../contract-as/assembly/uref";
import { CLValue, CLType, CLTypeTag } from "../../../../contract-as/assembly/clvalue";
import { Pair } from "../../../../contract-as/assembly/pair";
import { RuntimeArgs } from "../../../../contract-as/assembly/runtime_args";

const CONTRACT_INITIAL_VERSION: u8 = 1;
const METADATA_HASH_KEY = "metadata_hash_key";
const METADATA_ACCESS_KEY = "metadata_access_key";
const RESTRICTED_CONTRACT = "restricted_contract";
const RESTRICTED_SESSION = "restricted_session";
const RESTRICTED_SESSION_CALLER = "restricted_session_caller";
const UNRESTRICTED_CONTRACT_CALLER = "unrestricted_contract_caller";
const RESTRICTED_CONTRACT_CALLER_AS_SESSION = "restricted_contract_caller_as_session";
const UNCALLABLE_SESSION = "uncallable_session";
const UNCALLABLE_CONTRACT = "uncallable_contract";
const CALL_RESTRICTED_ENTRY_POINTS = "call_restricted_entry_points";



export function restricted_session(): void { }

export function restricted_contract(): void { }

export function restricted_session_caller(): void {
  let metadata_hash_bytes = CL.getNamedArg("metadata_hash");
  let metadataKey = Key.fromBytes(metadata_hash_bytes).unwrap();
  CL.callVersionedContract(
    <Uint8Array>metadataKey.hash,
    CONTRACT_INITIAL_VERSION,
    RESTRICTED_SESSION,
    new RuntimeArgs(),
  );
}

function contract_caller(): void {
  let metadata_hash_bytes = CL.getNamedArg("metadata_hash");
  let metadataKey = Key.fromBytes(metadata_hash_bytes).unwrap();
  CL.callVersionedContract(
    <Uint8Array>metadataKey.hash,
    CONTRACT_INITIAL_VERSION,
    RESTRICTED_CONTRACT,
    new RuntimeArgs(),
  );
}

export function unrestricted_contract_caller(): void {
  contract_caller();
}

export function restricted_contract_caller_as_session(): void {
  contract_caller();
}

export function uncallable_session(): void { }

export function uncallable_contract(): void { }

export function call_restricted_entry_points(): void {
  // We're aggresively removing exports that aren't exposed through contract header so test
  // ensures that those exports are still inside WASM.
  uncallable_session();
  uncallable_contract();
}


function createGroup(packageHash: Uint8Array, accessURef: URef): URef {
  let key = Key.create(CLValue.fromURef(accessURef));
  if (key === null) {
    Error.fromErrorCode(ErrorCode.Formatting).revert();
    return <URef>unreachable();
  }

  CL.putKey("saved_uref", key);

  let existingURefs: Array<URef> = [<URef>key.uref];

  let newURefs = CL.createContractUserGroup(
    packageHash,
    accessURef,
    "Group 1",
    1,
    existingURefs,
  );

  if (newURefs.length != 1) {
    Error.fromUserError(4464 + 1000 + 1).revert();
    return <URef>unreachable();
  }
  return newURefs[0];
}

function createEntryPoints(): CL.EntryPoints {
  let entryPoints = new CL.EntryPoints();
  let restrictedSession = new CL.EntryPoint(
    RESTRICTED_SESSION,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    new CL.GroupAccess(["Group 1"]),
    CL.EntryPointType.Session,
  );
  entryPoints.addEntryPoint(restrictedSession);

  let restricted_contract = new CL.EntryPoint(
    RESTRICTED_CONTRACT,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    new CL.GroupAccess(["Group 1"]),
    CL.EntryPointType.Contract,
  );
  entryPoints.addEntryPoint(restricted_contract);

  let restricted_session_caller = new CL.EntryPoint(
    RESTRICTED_SESSION_CALLER,
    new Array<Pair<String, CLType>>(),
    // vec![Parameter::new("metadata_hash", CLType::Key)],
    new CLType(CLTypeTag.Unit),
    new CL.PublicAccess(),
    CL.EntryPointType.Session,
  );
  entryPoints.addEntryPoint(restricted_session_caller);

  let restricted_contract2 = new CL.EntryPoint(
    RESTRICTED_CONTRACT,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    new CL.GroupAccess(["Group 1"]),
    CL.EntryPointType.Contract,
  );
  entryPoints.addEntryPoint(restricted_contract2);

  let unrestricted_contract_caller = new CL.EntryPoint(
    UNRESTRICTED_CONTRACT_CALLER,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    // Made public because we've tested deploy level auth into a contract in
    // RESTRICTED_CONTRACT entrypoint
    new CL.PublicAccess(),
    // NOTE: Public contract authorizes any contract call, because this contract has groups
    // uref in its named keys
    CL.EntryPointType.Contract,
  );
  entryPoints.addEntryPoint(unrestricted_contract_caller);

  let unrestricted_contract_caller_as_session = new CL.EntryPoint(
    RESTRICTED_CONTRACT_CALLER_AS_SESSION,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    // Made public because we've tested deploy level auth into a contract in
    // RESTRICTED_CONTRACT entrypoint
    new CL.PublicAccess(),
    // NOTE: Public contract authorizes any contract call, because this contract has groups
    // uref in its named keys
    CL.EntryPointType.Session,
  );
  entryPoints.addEntryPoint(unrestricted_contract_caller_as_session);

  let uncallable_session = new CL.EntryPoint(
    UNCALLABLE_SESSION,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    // Made public because we've tested deploy level auth into a contract in
    // RESTRICTED_CONTRACT entrypoint
    new CL.GroupAccess([]),
    // NOTE: Public contract authorizes any contract call, because this contract has groups
    // uref in its named keys
    CL.EntryPointType.Session,
  );
  entryPoints.addEntryPoint(uncallable_session);

  let uncallable_contract = new CL.EntryPoint(
    UNCALLABLE_CONTRACT,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    // Made public because we've tested deploy level auth into a contract in
    // RESTRICTED_CONTRACT entrypoint
    new CL.GroupAccess([]),
    // NOTE: Public contract authorizes any contract call, because this contract has groups
    // uref in its named keys
    CL.EntryPointType.Session,
  );
  entryPoints.addEntryPoint(uncallable_contract);

  // Directly calls entryPoints that are protected with empty group of lists to verify that even
  // though they're not callable externally, they're still visible in the WASM.
  let call_restricted_entry_points = new CL.EntryPoint(
    CALL_RESTRICTED_ENTRY_POINTS,
    new Array<Pair<String, CLType>>(),
    new CLType(CLTypeTag.Unit),
    // Made public because we've tested deploy level auth into a contract in
    // RESTRICTED_CONTRACT entrypoint
    new CL.PublicAccess(),
    // NOTE: Public contract authorizes any contract call, because this contract has groups
    // uref in its named keys
    CL.EntryPointType.Session,
  );
  entryPoints.addEntryPoint(call_restricted_entry_points);

  return entryPoints;
}

function installVersion1(
  contractPackageHash: Uint8Array,
  accessURef: URef,
  restrictedURef: URef,
): void {
  let contractVariable = Key.create(CLValue.fromI32(0));
  if (contractVariable === null) {
    Error.fromErrorCode(ErrorCode.Formatting).revert();
    unreachable();
    return;
  }

  let namedKeys = new Array<Pair<String, Key>>();
  namedKeys.push(new Pair("contract_named_key", <Key>contractVariable));
  namedKeys.push(new Pair("restricted_uref", Key.fromURef(restrictedURef)));

  let entryPoints = createEntryPoints();

  let bytes = CL.addContractVersion(
    contractPackageHash,
    accessURef,
    entryPoints,
    namedKeys,
  );


}


export function call(): void {
  let createResult = CL.createContractPackageAtHash();
  CL.putKey(METADATA_HASH_KEY, Key.fromHash(createResult.packageHash));
  CL.putKey(METADATA_ACCESS_KEY, Key.fromURef(createResult.accessURef));

  let restrictedURef = createGroup(createResult.packageHash, createResult.accessURef);
  installVersion1(createResult.packageHash, createResult.accessURef, restrictedURef);
}
