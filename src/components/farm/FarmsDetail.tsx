import React, { useEffect, useRef, useState, useContext } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { isMobile } from '~utils/device';
import { ArrowLeftIcon } from '~components/icon/FarmV2';
import StakeTab from '~components/farm/StakeTab';
import PoolTab from '~components/farm/PoolTab';
import { useHistory, useLocation } from 'react-router-dom';
import { getPool } from '~services/indexer';
import { ftGetTokenMetadata } from '../../services/ft-contract';
import { mftGetBalance } from '~services/mft-contract';
import { getMftTokenId } from '~utils/token';
import getConfig from '../../services/config';
import {
  toPrecision,
  toReadableNumber,
  toNonDivisibleNumber,
  toInternationalCurrencySystem,
  percent,
  formatWithCommas,
  percentLess,
  calculateFairShare,
} from '../../utils/numbers';
import {
  LP_TOKEN_DECIMALS,
  LP_STABLE_TOKEN_DECIMALS,
  withdrawAllReward,
} from '../../services/m-token';
import { useTokens } from '~state/token';
const STABLE_POOL_ID = getConfig().STABLE_POOL_ID;
const getInitTopActiveTab = (props: any): any => {
  const urlParamId = props.urlParamId;
  const paramArr = urlParamId.split('-');
  const result: any = {};
  if (paramArr[1] == 's') {
    result.tab = 'stake';
  } else {
    result.tab = 'pool';
  }
  result.status = paramArr[2];
  return result;
};
export default function FarmsDetail(props: any) {
  const { detailData, emptyDetailData, tokenPriceList } = props;
  const [topActiveTab, setTopActiveTab] = useState(
    getInitTopActiveTab(props).tab
  );
  const history = useHistory();
  const seedId = detailData[0]['seed_id'];
  const pool = detailData[0]['pool'];
  const { token_account_ids } = pool;
  const tokens = useTokens(token_account_ids) || [];
  const goBacktoFarms = () => {
    history.replace('/farmsv2');
    emptyDetailData();
  };
  const displaySymbols = () => {
    const symbols = pool?.token_symbols || [];
    let result = '';
    symbols.forEach((item: string, index: number) => {
      if (index == symbols.length - 1) {
        result += item;
      } else {
        result += item + '-';
      }
    });
    return result;
  };
  const displayImgs = () => {
    const tokenList: any[] = [];
    (tokens || []).forEach((token: any) => {
      tokenList.push(
        <label
          key={token.id}
          className={`h-11 w-11 rounded-full overflow-hidden border border-gradientFromHover -ml-1.5`}
        >
          <img src={token.icon} className="w-full h-full"></img>
        </label>
      );
    });
    return tokenList;
  };
  const switchTopTab = (tab: string) => {
    const tabMap = {
      pool: 'p',
      stake: 's',
    };
    setTopActiveTab(tab);
    history.replace({
      pathname: `/farmsV2/${pool.id}-${tabMap[tab]}-${
        getInitTopActiveTab(props).status
      }`,
    });
  };
  return (
    <div className={`m-auto lg:w-580px md:w-5/6 xs:w-11/12`}>
      <div className="breadCrumbs flex items-center text-farmText text-base hover:text-white">
        <ArrowLeftIcon onClick={goBacktoFarms} className="cursor-pointer" />
        <label className="cursor-pointer" onClick={goBacktoFarms}>
          <FormattedMessage id="farms" />
        </label>
      </div>
      <div className="pairTab flex justify-between items-center mt-7">
        <div className="left flex items-center h-11 ml-3">
          <span className="flex">{displayImgs()}</span>
          <span className="flex items-center cursor-pointer text-white font-bold text-xl ml-4">
            {displaySymbols()}
          </span>
        </div>
        <div className="flex items-center w-64 p-1 bg-cardBg rounded-2xl">
          <span
            onClick={() => {
              switchTopTab('pool');
            }}
            className={`flex justify-center items-center w-1/3 h-10 flex-grow text-sm font-medium cursor-pointer rounded-xl ${
              topActiveTab == 'pool'
                ? 'bg-farmV2TabColor text-white'
                : 'text-primaryText'
            }`}
          >
            <FormattedMessage id="POOL"></FormattedMessage>
          </span>
          <span
            onClick={() => {
              switchTopTab('stake');
            }}
            className={`flex justify-center items-center w-1/3 h-10 flex-grow  text-sm font-medium cursor-pointer rounded-xl ${
              topActiveTab == 'stake'
                ? 'bg-farmV2TabColor text-white'
                : 'text-primaryText'
            }`}
          >
            <FormattedMessage id="STAKE"></FormattedMessage>
          </span>
        </div>
      </div>
      <StakeTab
        detailData={detailData}
        tokenPriceList={tokenPriceList}
        hidden={topActiveTab == 'pool'}
      ></StakeTab>
      <PoolTab
        detailData={detailData}
        tokenPriceList={tokenPriceList}
        hidden={topActiveTab == 'stake'}
      ></PoolTab>
    </div>
  );
}
