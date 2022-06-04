import React, { useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import getConfig from '../../services/config';
import { FormattedMessage } from 'react-intl';
import { CloseIcon } from '../icon/Actions';
import { isMobile } from '../../utils/device';
import { checkTransaction } from '../../services/swap';
import { getCurrentWallet } from '~utils/sender-wallet';
import { senderSignedInToast } from './senderSignInPopUp';
import { removeSenderLoginRes } from '../../utils/sender-wallet';
import { useHistory } from 'react-router-dom';
import { XREF_TOKEN_ID } from '../../services/near';
import { REF_FI_ACCOUNT_PAGE_WITHDRAW } from '../../services/token';

export enum TRANSACTION_WALLET_TYPE {
  NEAR_WALLET = 'transactionHashes',
  SENDER_WALLET = 'transactionHashesSender',
}

export enum TRANSACTION_ERROR_TYPE {
  SLIPPAGE_VIOLATION = 'Slippage Violation',
  INVALID_PARAMS = 'Invalid Params',
}

const ERROR_PATTERN = {
  slippageErrorPattern: /ERR_MIN_AMOUNT|slippage error/i,
  invaliParamsErrorPattern: /invalid params/i,
};

export enum TRANSACTION_STATE {
  SUCCESS = 'success',
  FAIL = 'fail',
}

export const getURLInfo = () => {
  const search = window.location.search;

  const pathname = window.location.pathname;

  const errorCode = new URLSearchParams(search).get('errorCode');

  const signInErrorType = new URLSearchParams(search).get('signInErrorType');

  const txHashes = (
    new URLSearchParams(search).get(TRANSACTION_WALLET_TYPE.NEAR_WALLET) ||
    new URLSearchParams(search).get(TRANSACTION_WALLET_TYPE.SENDER_WALLET)
  )?.split(',');

  return {
    txHash:
      txHashes && txHashes.length > 0 ? txHashes[txHashes.length - 1] : '',
    pathname,
    signInErrorType,
    errorCode,
    txHashes,
  };
};

export const swapToast = (txHash: string, tip?: JSX.Element | string) => {
  toast(
    <a
      className="text-white w-full h-full pl-1.5"
      href={`${getConfig().explorerUrl}/txns/${txHash}`}
      target="_blank"
      style={{
        lineHeight: '48px',
      }}
    >
      {tip}
      .&nbsp;
      <FormattedMessage id="click_to_view" defaultMessage="Click to view" />
    </a>,
    {
      autoClose: 8000,
      closeOnClick: true,
      hideProgressBar: false,
      closeButton: <CloseIcon />,
      progressStyle: {
        background: '#00FFD1',
        borderRadius: '8px',
      },
      style: {
        background: '#1D2932',
        boxShadow: '0px 0px 10px 10px rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
      },
    }
  );
};

export const failToast = (txHash: string, errorType?: string) => {
  toast(
    <a
      className="text-error w-full h-full pl-1.5 py-1"
      href={`${getConfig().explorerUrl}/txns/${txHash}`}
      target="_blank"
      style={{
        lineHeight: '20px',
      }}
    >
      <FormattedMessage
        id="transaction_failed"
        defaultMessage="Transaction failed"
      />
      {'. '}
      <br />
      <FormattedMessage id="Type" defaultMessage="Type" />: {` `}
      {errorType}
      {'. '}
      <FormattedMessage id="click_to_view" defaultMessage="Click to view" />
    </a>,
    {
      autoClose: false,
      closeOnClick: true,
      hideProgressBar: false,
      closeButton: <CloseIcon />,
      progressStyle: {
        background: '#FF7575',
        borderRadius: '8px',
      },
      style: {
        background: '#1D2932',
        boxShadow: '0px 0px 10px 10px rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
      },
    }
  );
};

export const TranslationWrapper = (text: string) => (
  <FormattedMessage id={text} />
);

export const methodNameParser = (parsedMethodName: string) => {
  switch (parsedMethodName) {
    case 'add_simple_pool':
      return TranslationWrapper('create_pool_successfull');

    // unstake on farms page
    case 'withdraw_seed':
      return TranslationWrapper('unstake_successfull');

    // unstake xref
    case 'unstake':
      return TranslationWrapper('unstake_successfull');

    // farm stake
    case 'mft_transfer_call':
      return TranslationWrapper('stake_successfull');

    // stake xref
    case 'stake':
      return TranslationWrapper('stake_successfull');

    case 'buy':
      return TranslationWrapper('trading_successfull');

    case 'sell':
      return TranslationWrapper('trading_successfull');

    case 'add_stable_liquidity':
      return TranslationWrapper('add_liquidity_successfull');

    case 'add_liquidity':
      return TranslationWrapper('add_liquidity_successfull');

    case 'remove_liquidity_by_tokens':
      return TranslationWrapper('remove_liquidity_successfull');

    case 'remove_liquidity':
      return TranslationWrapper('remove_liquidity_successfull');

    case 'withdraw':
      return TranslationWrapper('withdraw_successfull');

    case 'withdraw_reward':
      return TranslationWrapper('withdraw_successfull');

    default:
      return TranslationWrapper('swap_successfull');
  }
};

export const checkAccountTip = () => {
  toast(
    <span
      className="w-full h-full pl-1.5 text-base"
      style={{
        color: '#C4C4C4',
        width: '286px',
      }}
    >
      <FormattedMessage
        id="ref_account_balance_tip"
        defaultMessage="It seems like an error occurred while adding/removing liquidity to the pool"
      />
    </span>,
    {
      autoClose: false,
      closeOnClick: true,
      hideProgressBar: false,
      closeButton: <CloseIcon />,
      progressStyle: {
        background: '#00FFD1',
        borderRadius: '8px',
      },
      style: {
        background: '#1D2932',
        boxShadow: '0px 0px 10px 10px rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
        minHeight: '60px',
        margin: 'auto',
        marginTop: isMobile() ? '20px' : 'none',
        width: isMobile() ? '320px' : 'none',
      },
    }
  );
};

export const checkCrossSwapTransactions = async (txHashes: string[]) => {
  const lastTx = txHashes.pop();
  const txDetail: any = await checkTransaction(lastTx);

  const parsedOut = parsedTransactionSuccessValue(txDetail);

  const erc20FailPattern = /burn amount exceeds balance/i;

  if (
    erc20FailPattern.test(parsedOut) ||
    (parsedOut.toString().trim().length === 14 &&
      parsedOut.toString().trim().indexOf('|R') !== -1)
  ) {
    return {
      hash: lastTx,
      status: false,
      errorType: 'Withdraw Failed',
    };
  } else {
    const secondLastHash = txHashes.pop();
    const secondDetail = await checkTransaction(secondLastHash);

    const slippageErrprReg = /INSUFFICIENT_OUTPUT_AMOUNT/i;
    const expiredErrorReg = /EXPIRED/i;

    const parsedOutput = parsedTransactionSuccessValue(secondDetail);

    if (slippageErrprReg.test(parsedOutput)) {
      return {
        hash: secondLastHash,
        status: false,
        errorType: 'Slippage Violation',
      };
    } else if (expiredErrorReg.test(parsedOutput)) {
      return {
        hash: secondLastHash,
        status: false,
        errorType: 'Expired',
      };
    } else {
      return {
        hash: lastTx,
        status: true,
      };
    }
  }
};

export const parsedTransactionSuccessValue = (res: any) => {
  const status: any = res.status;

  const data: string | undefined = status.SuccessValue;

  if (data) {
    const buff = Buffer.from(data, 'base64');
    const parsedData = buff.toString('ascii');
    return parsedData;
  }
};

export const parsedLog = (log: string) => {
  const buff = Buffer.from(log, 'base64');
  const dataString = buff.toString('ascii');
  return JSON.parse(dataString);
};

export const usnBuyAndSellToast = (txHash: string) => {
  toast(
    <a
      className="text-white w-full h-full pl-1.5"
      href={`${getConfig().explorerUrl}/txns/${txHash}`}
      target="_blank"
      style={{
        lineHeight: '48px',
      }}
    >
      <FormattedMessage
        id="usn_successful_click_to_view"
        defaultMessage="Swap successful. Click to view"
      />
    </a>,
    {
      autoClose: 8000,
      closeOnClick: true,
      hideProgressBar: false,
      closeButton: <CloseIcon />,
      progressStyle: {
        background: '#00FFD1',
        borderRadius: '8px',
      },
      style: {
        background: '#1D2932',
        boxShadow: '0px 0px 10px 10px rgba(0, 0, 0, 0.15)',
        borderRadius: '8px',
      },
    }
  );
};

export const getErrorMessage = (res: any) => {
  const isSlippageError = res.receipts_outcome.some((outcome: any) => {
    return ERROR_PATTERN.slippageErrorPattern.test(
      outcome?.outcome?.status?.Failure?.ActionError?.kind?.FunctionCallError
        ?.ExecutionError
    );
  });

  const isInvalidAmountError = res.receipts_outcome.some((outcome: any) => {
    return ERROR_PATTERN.invaliParamsErrorPattern.test(
      outcome?.outcome?.status?.Failure?.ActionError?.kind?.FunctionCallError
        ?.ExecutionError
    );
  });

  if (isSlippageError) {
    return TRANSACTION_ERROR_TYPE.SLIPPAGE_VIOLATION;
  } else if (isInvalidAmountError) {
    return TRANSACTION_ERROR_TYPE.INVALID_PARAMS;
  } else {
    return null;
  }
};

export const getMethodName = async (transaction: any, txHashes?: any) => {
  const defaultName = transaction?.actions[0]?.['FunctionCall']?.method_name;

  const onlyWithdraw = transaction?.actions?.every(
    (a: any) => a?.['FunctionCall']?.method_name === 'withdraw'
  );

  const args = parsedLog(transaction?.actions[0]?.['FunctionCall']?.args);
  const methodFromAccountPage = localStorage.getItem(
    REF_FI_ACCOUNT_PAGE_WITHDRAW
  );

  // for xref stake
  if (defaultName === 'ft_transfer_call' && args?.receiver_id === XREF_TOKEN_ID)
    return 'stake';
  else if (onlyWithdraw) {
    // for remove liquidity

    if (txHashes?.length > 1) {
      const secondLastTx = txHashes[txHashes.length - 2];
      const detail = (await checkTransaction(secondLastTx)) as any;

      const implicitMethodName =
        detail.transaction?.actions[0]?.['FunctionCall']?.method_name;

      if (
        implicitMethodName === 'remove_liquidity' ||
        implicitMethodName === 'remove_liquidity_by_tokens'
      ) {
        return 'remove_liquidity';
      } else return defaultName;
    } else return defaultName;
  } else if (methodFromAccountPage) {
    // for near_withdraw and aurora withdraw
    localStorage.removeItem(REF_FI_ACCOUNT_PAGE_WITHDRAW);
    return 'withdraw';
  } else return defaultName;
};

export const usePopUp = ({ globalState }: { globalState: any }) => {
  const { txHash, pathname, signInErrorType, txHashes, errorCode } =
    getURLInfo();

  if (errorCode) localStorage.removeItem(REF_FI_ACCOUNT_PAGE_WITHDRAW);

  const replaceHistoryState = () =>
    window.history.replaceState({}, '', window.location.origin + pathname);

  const isSignedIn = globalState.isSignedIn;

  // sender signInError
  useEffect(() => {
    if (signInErrorType) {
      senderSignedInToast(signInErrorType);
      removeSenderLoginRes();
      replaceHistoryState();
    }
  }, [signInErrorType]);

  // general toast
  useEffect(() => {
    if (txHash && isSignedIn && txHashes) {
      checkTransaction(txHash)
        .then(async (res: any) => {
          const errorMsg = getErrorMessage(res);
          const transaction = res.transaction;

          const methodName = await getMethodName(transaction, txHashes);

          const isAurora = res?.transaction?.receiver_id === 'aurora';

          const ifCall =
            res?.transaction?.actions?.length === 1 &&
            res?.transaction?.actions?.[0]?.FunctionCall?.method_name ===
              'call';

          const isSwapPro = txHashes?.length > 1 && isAurora && ifCall;

          return {
            isSwapPro,
            errorMsg,
            methodName,
          };
        })
        .then(({ errorMsg, isSwapPro, methodName }) => {
          if (isSwapPro) {
            checkCrossSwapTransactions(txHashes);
          } else if (errorMsg) {
            failToast(txHash);
          } else {
            swapToast(txHash, methodNameParser(methodName));
          }
          replaceHistoryState();
        });
    }
  }, [txHash, isSignedIn, txHashes]);
};
