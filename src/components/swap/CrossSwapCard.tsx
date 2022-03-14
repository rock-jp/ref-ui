import React, {
  useEffect,
  useState,
} from 'react';
import { TokenMetadata } from '../../services/ft-contract';
import { Pool } from '../../services/pool';
import ReactModal from 'react-modal';
import { EstimateSwapView } from '~services/swap';
import {getCurrentWallet} from "~utils/sender-wallet";
import {AccountID} from "@aurora-is-near/engine";

const SWAP_IN_KEY = 'REF_FI_SWAP_IN';
const SWAP_OUT_KEY = 'REF_FI_SWAP_OUT';
const SWAP_SLIPPAGE_KEY = 'REF_FI_SLIPPAGE_VALUE';
export const SWAP_USE_NEAR_BALANCE_KEY = 'REF_FI_USE_NEAR_BALANCE_VALUE';
const TOKEN_URL_SEPARATOR = '|';

export function DoubleCheckModal(
  props: ReactModal.Props & {
    pools: Pool[];
    tokenIn: TokenMetadata;
    tokenOut: TokenMetadata;
    from: string;
    onSwap: (e?: any) => void;
    swapsTodo: EstimateSwapView[];
    priceImpactValue: string;
  }
) {

  const [address, setAddress] = useState("");

  const account = getCurrentWallet().wallet.getAccount();

  const accountId = account && account.accountId;
  useEffect(() => {
    if (accountId) {
      const address = new AccountID(accountId).toAddress().toString();
      console.log(address);
      setAddress(address);
    }
  }, [accountId]);

  const onAddressChange = (e: any) => {
    setAddress(e.target.value);
  };

  return (
    <>
      <div>
        <div className="container">
          <div className="row mb-3">
            <label htmlFor="eth-address">Aurora address:</label>
            <input
                name="eth-address"
                className="form-control"
                type="text"
                placeholder="0x1234..."
                value={address}
                onChange={onAddressChange}
            />
          </div>
        </div>
      </div>
    </>
  );
}
