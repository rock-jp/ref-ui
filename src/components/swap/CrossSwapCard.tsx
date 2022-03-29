import React, {
  useEffect,
  useState,
} from 'react';
import {AccountID} from "@aurora-is-near/engine";
import { wallet } from '~services/near';

const SWAP_IN_KEY = 'REF_FI_SWAP_IN';
const SWAP_OUT_KEY = 'REF_FI_SWAP_OUT';
const SWAP_SLIPPAGE_KEY = 'REF_FI_SLIPPAGE_VALUE';
export const SWAP_USE_NEAR_BALANCE_KEY = 'REF_FI_USE_NEAR_BALANCE_VALUE';
const TOKEN_URL_SEPARATOR = '|';

function CrossSwapCard() {

  const [address, setAddress] = useState("");
  function getAccountAddress() {
    return new AccountID(wallet.getAccountId()).toAddress().toString();
  }

  useEffect(() => {
    setAddress(getAccountAddress());
  }, []);

  return (
      <>
        <div className="py-12">
          <div className="bg-secondary">
            <div className="lg:text-center">
              <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Address</h2>
              <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">{address}</p>
            </div>
          </div>
        </div>
      </>
  );
}

export default CrossSwapCard;