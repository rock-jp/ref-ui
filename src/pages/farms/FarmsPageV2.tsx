import React, { useEffect, useRef, useState, useContext } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import SelectUi from '~components/farm/SelectUi';
import {
  RightArrowIcon,
  MultiIcon,
  CalcIcon,
  UpArrowIcon,
  SnakeImg,
} from '~components/icon/FarmV2';
import { GradientButton, ButtonTextWrapper } from '~components/button/Button';
import { Checkbox, CheckboxSelected, SortIcon } from '~components/icon';
import QuestionMark from '~components/farm/QuestionMark';
import ReactTooltip from 'react-tooltip';
import {
  list_user_seed_powers,
  list_user_rewards,
  getSeeds,
  getFarmList,
  getUnclaimedReward,
  getLPTokenId,
  Farm,
  FarmKind,
  classificationOfCoins,
  classificationOfCoins_key,
  incentiveLpTokenConfig,
  defaultConfig,
  extendType,
  claimRewardBySeed,
  claimRewardByFarm,
} from '~services/farm';
import { getTokenPriceList } from '~services/indexer';
import { getCurrentWallet, WalletContext } from '../../utils/sender-wallet';
import getConfig from '../../services/config';
import { PoolRPCView } from '../../services/api';
import { getPoolsByIds } from '../../services/indexer';
import {
  LP_TOKEN_DECIMALS,
  LP_STABLE_TOKEN_DECIMALS,
  withdrawAllReward,
} from '../../services/m-token';
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
  ftGetTokenMetadata,
  TokenMetadata,
  ftGetStorageBalance,
} from '../../services/ft-contract';
import { BigNumber } from 'bignumber.js';
import * as math from 'mathjs';
import { useTokens } from '~state/token';
import { getMftTokenId, toRealSymbol } from '~utils/token';
import { isMobile } from '~utils/device';
import moment from 'moment';
const STABLE_POOL_ID = getConfig().STABLE_POOL_ID;

export default function V2FarmsPage() {
  const [user_stake_powers_list, set_user_stake_powers_list] = useState<
    Record<string, string>
  >({});
  let [user_reward_list, set_user_reward_list] = useState<
    Record<string, string>
  >({});
  let [tokenPriceList, setTokenPriceList] = useState<any>({});
  const [farm_origin_List, set_farm_origin_List] = useState<
    Record<string, any>
  >({});
  let [farm_display_List, set_farm_display_List] = useState<any>([]);

  const [seeds, setSeeds] = useState<Record<string, string>>({});
  const intl = useIntl();
  const { signedInState } = useContext(WalletContext);
  const isSignedIn = signedInState.isSignedIn;
  const [noData, setNoData] = useState(false);
  /** search area options start **/
  const sortList = {
    default: intl.formatMessage({ id: 'default' }),
    multiple: intl.formatMessage({ id: 'multiple' }),
    apr: intl.formatMessage({ id: 'apr' }),
    new: intl.formatMessage({ id: 'new' }),
    total_staked: intl.formatMessage({ id: 'total_staked' }),
  };
  const statusList = {
    live: intl.formatMessage({ id: 'live' }),
    ended: intl.formatMessage({ id: 'ended_search' }),
    my: intl.formatMessage({ id: 'my_farms' }),
  };
  const coinList = { all: intl.formatMessage({ id: 'allOption' }) };
  classificationOfCoins_key.forEach((key) => {
    coinList[key] = intl.formatMessage({ id: key });
  });
  let [sort, setSort] = useState('default');
  let [status, setStatus] = useState('live');
  let [coin, setCoin] = useState('all');
  /** search area options end **/
  useEffect(() => {
    init();
  }, [isSignedIn]);
  async function init() {
    let requestList: [
      Promise<Record<string, string>>,
      Promise<any>,
      Promise<Record<string, string>>,
      Promise<Record<string, any>>,
      Promise<Record<string, string>>
    ];
    if (isSignedIn) {
      requestList = [
        list_user_seed_powers({}),
        getTokenPriceList(),
        getSeeds({}),
        getFarmList(),
        list_user_rewards({}),
      ];
    } else {
      const emptyObj = async () => {
        return {};
      };
      requestList = [
        emptyObj(),
        getTokenPriceList(),
        getSeeds({}),
        getFarmList(),
        emptyObj(),
      ];
    }
    const result = await Promise.all(requestList);
    const userStakePowersList: Record<string, string> = result[0];
    const tokenPriceList: any = result[1];
    const seeds: Record<string, string> = result[2];
    const farmList: Record<string, any> = result[3];
    const userRewardList: Record<string, string> = result[4];
    set_user_stake_powers_list(userStakePowersList);
    set_user_reward_list(userRewardList);
    setTokenPriceList(tokenPriceList);
    setSeeds(seeds);
    const filledFarmList = await getFarmDisplayList(result);
    const farmDisplayList = mergeFarms(filledFarmList);
    console.log('777777777777', farmDisplayList);
    farm_display_List = farmDisplayList;
    searchByCondition();
  }
  function mergeFarms(farms: any) {
    const tempMap = {};
    while (farms.length) {
      let current = farms.pop();
      const farmEnded = current.farm_status === 'Ended';

      if (farmEnded) {
        tempMap[current.start_at + current.seed_id] =
          tempMap[current.start_at + current.seed_id] || [];
        tempMap[current.start_at + current.seed_id].push(current);
      } else {
        tempMap[current.seed_id] = tempMap[current.seed_id] || [];
        tempMap[current.seed_id].push(current);
      }
    }
    const mergedFarms = Object.values(tempMap);
    mergedFarms.forEach((farms: FarmKind[] & extendType) => {
      const poolId = farms[0].pool.id;
      // total apr
      let totalApr = 0;
      farms.forEach(function (item: FarmKind) {
        totalApr += Number(item.apr);
      });
      // multiple
      const multiple = incentiveLpTokenConfig[poolId] || '0';
      // default
      const defaultValue = defaultConfig[poolId] || '0';
      farms.totalApr = totalApr;
      farms.multiple = multiple;
      farms.default = defaultValue;
    });
    return mergedFarms;
  }
  async function getFarmDisplayList(data: any) {
    const [userStakePowersList, tokenPriceList, seeds, farmList] = data;
    const config = getConfig();
    // get valid farms
    const blackFarmList = new Set(config.blackList || []);
    const validFarmList: Farm[] = farmList.filter((item: Farm) => {
      const { farm_id } = item;
      const arr = farm_id.split('@');
      if (!blackFarmList.has(arr[1])) {
        return true;
      }
    });
    // get pools
    const pool_ids = validFarmList.map((f: any) => {
      return getLPTokenId(f.farm_id);
    });
    let poolList: Record<string, PoolRPCView> = {};
    const pools = await getPoolsByIds({ pool_ids });
    if (pools) {
      poolList = pools.reduce(
        (obj: any, pool: any) => ({ ...obj, [pool.id]: pool }),
        {}
      );
    }
    // fill each farm data
    const tasks = validFarmList.map(async (f) => {
      const poolId = getLPTokenId(f.farm_id);
      const pool: PoolRPCView = poolList[poolId];
      const fi: FarmKind = await fillFarmInfo({
        farm: f,
        pool,
        userSeedPowers: userStakePowersList[f.seed_id],
        seedAmount: seeds[f.seed_id],
        tokenPriceList: tokenPriceList,
      });
      return fi;
    });
    return await Promise.all(tasks);
  }
  async function fillFarmInfo({
    farm,
    pool,
    userSeedPowers,
    seedAmount,
    tokenPriceList,
  }: any) {
    const isSignedIn: boolean = getCurrentWallet().wallet.isSignedIn();
    const { tvl, token_account_ids, id: poolId } = pool;
    const DECIMALS =
      STABLE_POOL_ID == poolId ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    // get seed total stake worth
    const poolTvl = tvl;
    const poolSts = Number(
      toReadableNumber(DECIMALS, pool.shares_total_supply)
    );
    // get seed total stake amount
    const seedTotalStakedAmount = toReadableNumber(DECIMALS, seedAmount);
    const seedTotalStakedWorth =
      poolSts === 0
        ? 0
        : Number(
            toPrecision(
              ((Number(seedTotalStakedAmount) * poolTvl) / poolSts).toString(),
              1
            )
          );
    // get user seed stake amount
    const userStakedAmount = toReadableNumber(DECIMALS, userSeedPowers ?? '0');
    // get rewardToken detail
    const rewardToken = await ftGetTokenMetadata(farm.reward_token);
    // get weekly rewards amount
    const rewardNumberPerWeek = math.round(
      math.evaluate(
        `(${farm.reward_per_session} / ${farm.session_interval}) * 604800`
      )
    );
    const rewardsPerWeekAmount = new BigNumber(
      toReadableNumber(
        rewardToken.decimals,
        new BigNumber(rewardNumberPerWeek.toString()).toFixed()
      )
    ).toFixed(0);
    // get apr
    const rewardTokenPrice = tokenPriceList
      ? tokenPriceList[rewardToken.id]?.price || 0
      : 0;
    const apr =
      seedTotalStakedWorth === 0
        ? '0'
        : toPrecision(
            (
              (1 / seedTotalStakedWorth) *
              (Number(rewardsPerWeekAmount) * Number(rewardTokenPrice)) *
              52 *
              100
            ).toString(),
            2
          );
    // get user unClaimed reward amount
    const seedId = farm.farm_id.slice(0, farm.farm_id.lastIndexOf('#'));
    let userUnclaimedRewardNumber: string =
      isSignedIn && +userStakedAmount
        ? await getUnclaimedReward(farm.farm_id)
        : '0';
    const userUnclaimedRewardAmount = toReadableNumber(
      rewardToken.decimals,
      userUnclaimedRewardNumber
    );
    // judge farm status
    if (farm.farm_status === 'Created') farm.farm_status = 'Pending';
    return {
      ...farm,
      rewardToken,
      rewardsPerWeekAmount,
      pool,
      seedTotalStakedWorth,
      seedTotalStakedAmount,
      apr,
      userStakedAmount,
      userUnclaimedRewardAmount,
    };
  }
  function changeSort(option: any) {
    const [id] = option;
    setSort(id);
    sort = id;
    searchByCondition();
  }
  function changeStatus(statusSelectOption: string) {
    setStatus(statusSelectOption);
    status = statusSelectOption;
    searchByCondition();
  }
  function changeCoin(coinSelectOption: string) {
    setCoin(coinSelectOption);
    coin = coinSelectOption;
    searchByCondition();
  }
  function searchByCondition() {
    farm_display_List = farm_display_List.sort();
    let noData;
    farm_display_List.length && (noData = true);
    const commonSeedFarms = mergeCommonSeedsFarms();
    // filter
    farm_display_List.forEach((item: FarmKind[] & extendType) => {
      // filter by both status and coin
      const { userStakedAmount, pool, seed_id, farm_id } = item[0];
      const isEnd = item[0].farm_status == 'Ended';
      const useStaked = Number(userStakedAmount) > 0;
      const { token_symbols, id } = pool;
      let condition1,
        condition2 = false;
      if (status == 'live') {
        condition1 = !isEnd;
      } else if (status == 'ended') {
        condition1 = isEnd;
      } else {
        if (useStaked) {
          let total_userUnclaimedReward = 0;
          item.forEach((farm: FarmKind) => {
            total_userUnclaimedReward += Number(farm.userUnclaimedRewardAmount);
          });
          const commonSeedFarmList = commonSeedFarms[seed_id] || [];
          if (
            isEnd &&
            !total_userUnclaimedReward &&
            commonSeedFarmList.length > 1
          ) {
            condition1 = false;
            for (let i = 0; i < commonSeedFarmList.length; i++) {
              if (commonSeedFarmList[i][0].farm_id == farm_id) {
                commonSeedFarmList.splice(i, 1);
                break;
              }
            }
          } else {
            condition1 = true;
          }
        }
      }
      if (coin != 'all') {
        const satisfiedTokenList = classificationOfCoins[coin];
        for (let i = 0; i < token_symbols.length; i++) {
          if (satisfiedTokenList.indexOf(token_symbols[i]) > -1) {
            condition2 = true;
            break;
          }
        }
      } else {
        condition2 = true;
      }
      if (condition1 && condition2) {
        item.show = true;
        noData = false;
      } else {
        item.show = false;
      }
    });
    // sort
    if (sort == 'new') {
      farm_display_List.sort((item1: FarmKind[], item2: FarmKind[]) => {
        const item1List = JSON.parse(JSON.stringify(item1));
        const item2List = JSON.parse(JSON.stringify(item2));
        item1List.sort((a: any, b: any) => {
          return b.start_at - a.start_at;
        });
        item2List.sort((a: any, b: any) => {
          return b.start_at - a.start_at;
        });
        const v = item2List[0].start_at - item1List[0].start_at;
        if (v == 0) {
          return item2.length - item1.length;
        } else {
          return v;
        }
      });
    } else if (sort == 'apr') {
      farm_display_List.sort(
        (item1: FarmKind[] & extendType, item2: FarmKind[] & extendType) => {
          return Number(item2.totalApr) - Number(item1.totalApr);
        }
      );
    } else if (sort == 'total_staked') {
      farm_display_List.sort(
        (item1: FarmKind[] & extendType, item2: FarmKind[] & extendType) => {
          return (
            Number(item2[0].seedTotalStakedWorth) -
            Number(item1[0].seedTotalStakedWorth)
          );
        }
      );
    } else if (sort == 'multiple') {
      farm_display_List.sort(
        (item1: FarmKind[] & extendType, item2: FarmKind[] & extendType) => {
          return Number(item2.multiple) - Number(item1.multiple);
        }
      );
    } else if (sort == 'default') {
      farm_display_List.sort(
        (item1: FarmKind[] & extendType, item2: FarmKind[] & extendType) => {
          return Number(item2.default) - Number(item1.default);
        }
      );
    }
    set_farm_display_List(farm_display_List);
  }
  function mergeCommonSeedsFarms() {
    const tempMap = {};
    const list = JSON.parse(JSON.stringify(farm_display_List));
    list.forEach((farm: FarmKind[]) => {
      const { seed_id } = farm[0];
      tempMap[seed_id] = tempMap[seed_id] || [];
      tempMap[seed_id].push(farm);
    });
    return tempMap;
  }
  return (
    <div className="relative w-1/3 m-auto" style={{ minWidth: '31rem' }}>
      <div className="title flex justify-center items-center text-3xl text-white mb-5">
        <FormattedMessage id="farms"></FormattedMessage>
      </div>
      <WithDrawBox
        userRewardList={user_reward_list}
        tokenPriceList={tokenPriceList}
      ></WithDrawBox>
      {/* <div className="swiper h-20 border border-green-500"></div> */}
      <div className="searchArea">
        <div className="flex justify-between items-center rounded-2xl bg-cardBg p-1.5">
          {Object.keys(statusList).map((item: string) => {
            return (
              <span
                onClick={() => {
                  changeStatus(item);
                }}
                key={item}
                className={`flex flex-grow w-12 justify-center items-center h-10 rounded-xl text-sm cursor-pointer ${
                  status == item
                    ? 'bg-farmV2TabColor text-white'
                    : 'bg-cardBg text-primaryText'
                }`}
              >
                {statusList[item]}
              </span>
            );
          })}
        </div>
        <div className="flex justify-between mt-5 items-start">
          <div className="flex flex-wrap">
            {Object.keys(coinList).map((item: string) => {
              return (
                <span
                  onClick={() => {
                    changeCoin(item);
                  }}
                  key={item}
                  className={`flex items-center justify-center mr-2.5 mb-2.5 text-xs rounded-lg h-6 px-5 cursor-pointer ${
                    coin == item
                      ? 'text-white bg-farmSbg'
                      : 'text-farmText bg-farmV2SmallTabCOlor'
                  }`}
                >
                  {coinList[item]}
                </span>
              );
            })}
          </div>
          <div className="flex items-center relative">
            <label className="text-farmText text-xs mr-2 whitespace-nowrap">
              <FormattedMessage id="sort_by" defaultMessage="Sort by" />
            </label>
            <SelectUi
              id={sort}
              list={sortList}
              onChange={changeSort}
              Icon={isMobile() ? SortIcon : ''}
              className="w-34"
            ></SelectUi>
          </div>
        </div>
      </div>
      <div className="farmListArea">
        {farm_display_List.map((farms: FarmKind[] & extendType) => {
          return (
            <div
              key={farms[0].farm_id}
              className={farms.show == false ? 'hidden' : ''}
            >
              <FarmView
                farms={farms}
                key={farms[0].farm_id}
                tokenPriceList={tokenPriceList}
              ></FarmView>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function FarmView(props: {
  farms: FarmKind[] & extendType;
  tokenPriceList: Record<string, any>;
}) {
  const { farms, tokenPriceList } = props;
  const {
    pool,
    seedTotalStakedWorth,
    seedTotalStakedAmount,
    userStakedAmount,
  } = farms[0];
  const { token_account_ids, id } = pool;
  const [claimLoading, setClaimLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const tokens = useTokens(token_account_ids) || [];
  function getTotalApr() {
    let apr = 0;
    farms.forEach(function (item: any) {
      apr += Number(item.apr);
    });
    if (apr == 0) {
      return '-';
    } else {
      return toPrecision(apr.toString(), 2) + '%';
    }
  }
  function getTotalRewardsPerWeek() {
    let totalPrice = 0;
    farms.forEach((farm: any) => {
      const { rewardsPerWeekAmount, rewardToken } = farm;
      const tokenPrice = tokenPriceList[rewardToken.id].price;
      if (tokenPrice && tokenPrice != 'N/A') {
        totalPrice += +rewardsPerWeekAmount * tokenPrice;
      }
    });
    if (totalPrice == 0) {
      return '-';
    } else {
      return `$${toInternationalCurrencySystem(totalPrice.toString(), 2)}`;
    }
  }
  function getAllRewardsSymbols() {
    const tempMap = {};
    farms.forEach((farm: any) => {
      const { rewardToken } = farm;
      const { icon, id } = rewardToken;
      tempMap[id] = icon;
    });
    return Object.entries(tempMap);
  }
  function getUserShares() {
    let percentage = '(-%)';
    if (Number(userStakedAmount) > 0) {
      const userStaked = userStakedAmount;
      const percentV = percent(userStaked, seedTotalStakedAmount);
      if (new BigNumber(0.001).isGreaterThan(percentV)) {
        percentage = '(<0.001%)';
      } else {
        percentage = `${toPrecision(percentV.toString(), 2)}%`;
      }
    }
    return (
      <>
        <span className="text-white text-lg mx-2">
          {toPrecision(userStakedAmount, 6)}
        </span>
        <span>{percentage}</span>
      </>
    );
  }
  function getTotalUnclaimedRewards() {
    let totalPrice = 0;
    farms.forEach((farm: any) => {
      const { rewardToken, userUnclaimedRewardAmount } = farm;
      const tokenPrice = tokenPriceList[rewardToken.id].price;
      if (tokenPrice && tokenPrice != 'N/A') {
        totalPrice += +userUnclaimedRewardAmount * tokenPrice;
      }
    });
    if (totalPrice == 0) {
      return '-';
    } else if (new BigNumber('0.01').isGreaterThan(totalPrice)) {
      return '<$0.01';
    } else {
      return `$${toInternationalCurrencySystem(totalPrice.toString(), 2)}`;
    }
  }
  function getAprTip() {
    const tempList = mergeCommonRewardsFarms();
    const lastList: any[] = [];
    tempList.forEach((arr: any[]) => {
      let farmsApr = '0';
      arr.forEach((farm: any) => {
        farmsApr = BigNumber.sum(farmsApr, farm.apr).valueOf();
      });
      lastList.push({
        commonRewardToken: arr[0].rewardToken,
        commonRewardTotalApr: farmsApr,
      });
    });
    // show last display string
    let result: string = '';
    lastList.forEach((item: any) => {
      const { commonRewardToken, commonRewardTotalApr } = item;
      const itemHtml = `<div class="flex justify-between items-center h-8">
                          <image class="w-5 h-5 rounded-full mr-7" src="${
                            commonRewardToken.icon
                          }"/>
                          <label class="text-xs text-navHighLightText">${
                            formatWithCommas(commonRewardTotalApr) + '%'
                          }</label>
                        </div>`;
      result += itemHtml;
    });
    return result;
  }
  function getUserSharesTip() {
    const farm = farms[0];
    if (Number(farm.userStakedAmount) <= 0) return '';
    const poolId = farms[0].pool.id;
    const DECIMALS =
      STABLE_POOL_ID == poolId ? LP_STABLE_TOKEN_DECIMALS : LP_TOKEN_DECIMALS;
    const shares = toNonDivisibleNumber(DECIMALS, farm.userStakedAmount);
    const slippageTolerance = 0;
    const { shares_total_supply, amounts, token_account_ids } = farm.pool;
    const minimumAmounts = amounts.reduce(
      (acc: any, totalSupply: any, index: any) => {
        acc[token_account_ids[index]] = toPrecision(
          percentLess(
            slippageTolerance,
            calculateFairShare({
              shareOf: totalSupply,
              contribution: shares,
              totalContribution: shares_total_supply,
            })
          ),
          0
        );
        return acc;
      },
      {}
    );
    let result: string = '';
    tokens.forEach((token: any) => {
      const { id, decimals } = token;
      const tokenNum = toReadableNumber(decimals, minimumAmounts[id]);
      const itemHtml = `<div class="flex justify-between items-center h-8">
                          <image class="w-5 h-5 rounded-full mr-7" src="${
                            token.icon
                          }"/>
                          <label class="text-xs text-navHighLightText">${toInternationalCurrencySystem(
                            tokenNum,
                            3
                          )}</label>
                        </div>`;
      result += itemHtml;
    });
    return result;
  }
  function getRewardsPerWeekTip() {
    const tempList = mergeCommonRewardsFarms();
    const lastList: any[] = [];
    tempList.forEach((arr: any[]) => {
      let rewardsPerWeek = '0';
      arr.forEach((farm: any) => {
        rewardsPerWeek = BigNumber.sum(
          rewardsPerWeek,
          farm.rewardsPerWeekAmount
        ).valueOf();
      });
      lastList.push({
        commonRewardToken: arr[0].rewardToken,
        commonRewardTotalRewardsPerWeek: rewardsPerWeek,
      });
    });
    // show last display string
    let result: string = '';
    lastList.forEach((item: any) => {
      const { commonRewardToken, commonRewardTotalRewardsPerWeek } = item;
      const itemHtml = `<div class="flex justify-between items-center h-8">
                          <image class="w-5 h-5 rounded-full mr-7" src="${
                            commonRewardToken.icon
                          }"/>
                          <label class="text-xs text-navHighLightText">${formatWithCommas(
                            commonRewardTotalRewardsPerWeek
                          )}</label>
                        </div>`;
      result += itemHtml;
    });
    return result;
  }
  function getTotalUnclaimedRewardsTip() {
    const tempList = mergeCommonRewardsFarms();
    const lastList: any[] = [];
    tempList.forEach((arr: any[]) => {
      let totalUserUnclaimedReward = '0';
      arr.forEach((farm: any) => {
        totalUserUnclaimedReward = BigNumber.sum(
          totalUserUnclaimedReward,
          farm.userUnclaimedRewardAmount
        ).valueOf();
      });
      lastList.push({
        commonRewardToken: arr[0].rewardToken,
        totalUserUnclaimedReward: totalUserUnclaimedReward,
      });
    });
    let result: string = '';
    lastList.forEach((item: any) => {
      const { commonRewardToken, totalUserUnclaimedReward } = item;
      let displayNum;
      if (
        !totalUserUnclaimedReward ||
        new BigNumber('0').isEqualTo(totalUserUnclaimedReward)
      ) {
        displayNum = '-';
      } else if (
        new BigNumber('0.001').isGreaterThan(totalUserUnclaimedReward)
      ) {
        displayNum = '<0.001';
      } else {
        displayNum = new BigNumber(totalUserUnclaimedReward).toFixed(3, 1);
      }
      const itemHtml = `<div class="flex justify-between items-center h-8">
                          <image class="w-5 h-5 rounded-full mr-7" src="${
                            commonRewardToken.icon
                          }"/>
                          <label class="text-xs text-navHighLightText">${formatWithCommas(
                            displayNum
                          )}</label>
                        </div>`;
      result += itemHtml;
    });
    return result;
  }
  function mergeCommonRewardsFarms() {
    const tempMap = {};
    farms.forEach((farm: any) => {
      const { rewardToken } = farm;
      tempMap[rewardToken.id] = tempMap[rewardToken.id] || [];
      tempMap[rewardToken.id].push(farm);
    });
    return Object.values(tempMap);
  }
  function isPending() {
    let pending: boolean = true;
    for (let i = 0; i < farms.length; i++) {
      if (moment.unix(farms[i].start_at).valueOf() > moment().valueOf()) {
        pending = true;
      } else {
        if (farms[i].farm_status != 'Pending') {
          pending = false;
          break;
        }
      }
    }
    return pending;
  }
  function isEnded() {
    return farms[0].farm_status == 'Ended';
  }
  function haveUnclaimedReward() {
    let have: boolean = false;
    for (let i = 0; i < farms.length; i++) {
      if (farms[i].userUnclaimedRewardAmount != '0') {
        have = true;
        break;
      }
    }
    return have;
  }
  function claimReward() {
    setClaimLoading(true);
    const data = farms[0];
    if (farms.length > 1) {
      claimRewardBySeed(data.seed_id)
        .then(() => {
          window.location.reload();
        })
        .catch((error) => {
          setError(error);
        });
    } else {
      claimRewardByFarm(data.farm_id)
        .then(() => {
          window.location.reload();
        })
        .catch((error) => {
          setError(error);
        });
    }
  }
  return (
    <div
      className={`relative bg-cardBg rounded-2xl overflow-hidden mb-3 ${
        isEnded() ? 'farmEnded' : ''
      }`}
    >
      {isPending() ? (
        <div className="farmStatus pending status-bar-left">
          <FormattedMessage id="pending" defaultMessage="PENDING" />
        </div>
      ) : null}
      <div className="baseInfo pt-4 pl-6 pr-4 pb-3.5">
        <div className="flex justify-between">
          <div className="left flex items-center h-11">
            <span className="flex">
              {tokens.map((token, index) => {
                return (
                  <label
                    key={token.id}
                    className={`h-11 w-11 rounded-full overflow-hidden border border-gradientFromHover ${
                      index != 0 ? '-ml-1.5' : ''
                    }`}
                  >
                    <img src={token.icon} className="w-full h-full"></img>
                  </label>
                );
              })}
            </span>
            <span className="flex items-center cursor-pointer text-white font-bold text-lg ml-4">
              {tokens.map((token, index) => {
                const { symbol } = token;
                const hLine = index === tokens.length - 1 ? '' : '-';
                return `${toRealSymbol(symbol)}${hLine}`;
              })}
              <RightArrowIcon className="ml-3" />
            </span>
          </div>
          <div className="right flex flex-col items-end">
            {farms.length > 1 ? (
              <span className="flex items-center bg-greenColor rounded h-5 px-2.5 text-black text-xs mb-3 character">
                <FormattedMessage id="multi_Rewards"></FormattedMessage>
                <MultiIcon className="ml-1.5" />
              </span>
            ) : null}
            {Number(farms.multiple) > 0 ? (
              <span className="flex items-center bg-greenColor rounded h-6 px-2.5 text-black text-xs character">
                x{farms.multiple}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="flex flex-col items-center">
            <label className="text-farmText text-sm">
              <FormattedMessage id="total_staked"></FormattedMessage>
            </label>
            <label className="text-white text-lg mt-1.5">
              {`${
                Number(seedTotalStakedWorth) == 0
                  ? '-'
                  : `$${toInternationalCurrencySystem(seedTotalStakedWorth, 2)}`
              }`}
            </label>
          </span>
          <span className="flex flex-col items-center">
            <span className="flex items-center">
              <label className="text-farmText text-sm">
                <FormattedMessage id="apr"></FormattedMessage>
              </label>
              <CalcIcon className="ml-1.5 cursor-pointer" />
            </span>
            <div
              className="text-xl text-white"
              data-type="info"
              data-place="top"
              data-multiline={true}
              data-tip={getAprTip()}
              data-html={true}
              data-for={'aprId' + farms[0].farm_id}
              data-class="reactTip"
            >
              <span className="text-white text-lg mt-1.5">{getTotalApr()}</span>
              <ReactTooltip
                id={'aprId' + farms[0].farm_id}
                backgroundColor="#1D2932"
                border
                borderColor="#7e8a93"
                effect="solid"
              />
            </div>
          </span>
          <span className="flex flex-col items-center">
            <label className="text-farmText text-sm">
              <FormattedMessage id="rewards_week"></FormattedMessage>
            </label>
            <span className="flex items-center mt-1.5">
              <div
                className="text-white text-right"
                data-class="reactTip"
                data-for={'rewardPerWeekId' + farms[0].farm_id}
                data-place="top"
                data-html={true}
                data-tip={getRewardsPerWeekTip()}
              >
                <span className="text-white text-lg mr-2">
                  {getTotalRewardsPerWeek()}
                </span>
                <ReactTooltip
                  id={'rewardPerWeekId' + farms[0].farm_id}
                  backgroundColor="#1D2932"
                  border
                  borderColor="#7e8a93"
                  effect="solid"
                />
              </div>
              <span className="flex">
                {getAllRewardsSymbols().map(
                  ([id, icon]: [string, string], index) => {
                    return (
                      <img
                        key={id}
                        src={icon}
                        className={`h-5 w-5 rounded-full border border-gradientFromHover ${
                          index != 0 ? '-ml-1' : ''
                        }`}
                      ></img>
                    );
                  }
                )}
              </span>
            </span>
          </span>
        </div>
      </div>
      {Number(farms[0].userStakedAmount) > 0 ? (
        <div className="operateArea flex items-center justify-between bg-farmV2BoxBg px-6 py-3.5 h-20">
          <div>
            <div className="flex items-center text-sm text-farmText">
              <FormattedMessage id="my_shares" />

              <div
                className="text-white"
                data-class="reactTip"
                data-for={'yourShareId' + farms[0].farm_id}
                data-place="top"
                data-html={true}
                data-tip={getUserSharesTip()}
              >
                {getUserShares()}
                <ReactTooltip
                  id={'yourShareId' + farms[0].farm_id}
                  backgroundColor="#1D2932"
                  border
                  borderColor="#7e8a93"
                  effect="solid"
                />
              </div>
            </div>
            <div className="flex items-center text-sm text-farmText">
              <FormattedMessage id="rewards" />
              <div
                className="text-white text-right"
                data-class="reactTip"
                data-for={'unclaimedRewardId' + farms[0].farm_id}
                data-place="top"
                data-html={true}
                data-tip={getTotalUnclaimedRewardsTip()}
              >
                <span className="text-white text-lg  mx-3">
                  {getTotalUnclaimedRewards()}
                </span>
                <ReactTooltip
                  id={'unclaimedRewardId' + farms[0].farm_id}
                  backgroundColor="#1D2932"
                  border
                  borderColor="#7e8a93"
                  effect="solid"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center">
            {isEnded() ? (
              <GradientButton
                color="#fff"
                className={`w-34 h-10 text-center text-base text-white focus:outline-none font-semibold `}
              >
                <FormattedMessage id="unstake" defaultMessage="Unstake" />
              </GradientButton>
            ) : (
              <GradientButton
                color="#fff"
                className={`w-34 h-10 text-center text-base text-white focus:outline-none font-semibold `}
              >
                <FormattedMessage id="stake" defaultMessage="Stake" />
              </GradientButton>
            )}
            {haveUnclaimedReward() ? (
              <GradientButton
                color="#fff"
                onClick={() => claimReward()}
                disabled={claimLoading}
                className={`w-34 h-10 text-center text-base text-white focus:outline-none font-semibold ml-3 `}
                loading={claimLoading}
              >
                <div>
                  <ButtonTextWrapper
                    loading={claimLoading}
                    Text={() => (
                      <FormattedMessage
                        id={farms.length > 1 ? 'claim_all' : 'claim'}
                      />
                    )}
                  />
                </div>
              </GradientButton>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {isEnded() ? null : (
            <div className="foperateArea items-center px-6 py-3.5  h-20">
              <GradientButton
                color="#fff"
                className={`w-full h-10 text-center text-base text-white focus:outline-none font-semibold `}
              >
                <FormattedMessage id="stake" defaultMessage="Stake" />
              </GradientButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WithDrawBox(props: { userRewardList: any; tokenPriceList: any }) {
  const { userRewardList, tokenPriceList } = props;
  const actualRewardList = {};
  Object.entries(userRewardList).forEach(([key, value]) => {
    if (Number(value) > 0) {
      actualRewardList[key] = value;
    }
  });
  const [rewardList, setRewardList] = useState([]);
  const [checkedList, setCheckedList] = useState<Record<string, any>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  const [withdrawLoading, setWithdrawLoading] = useState<boolean>(false);
  const rewardRef = useRef(null);
  const intl = useIntl();
  const withdrawNumber = 5;
  useEffect(() => {
    const tempList = Object.keys(actualRewardList).map(async (key: string) => {
      const rewardToken = await ftGetTokenMetadata(key);
      const price = tokenPriceList[key]?.price;
      return {
        tokenId: key,
        rewardToken,
        price,
        number: actualRewardList[key],
      };
    });
    Promise.all(tempList).then((list) => {
      list.forEach((item: any) => {
        rewardList[item.tokenId] = item;
      });
      setRewardList(rewardList);
    });
  }, [actualRewardList, tokenPriceList]);
  function valueOfWithDrawLimitTip() {
    const tip = intl.formatMessage({ id: 'over_tip' });
    let result: string = `<div class="text-navHighLightText text-xs w-52 text-left">${tip}</div>`;
    return result;
  }
  function switchDetailStatus() {
    setShowDetail(!showDetail);
  }
  function displaySinglePrice(price: string) {
    let displayPrice = '$-';
    if (price && price != 'N/A') {
      if (new BigNumber('0.01').isGreaterThan(price)) {
        displayPrice = '<$0.01';
      } else {
        displayPrice = `$${toInternationalCurrencySystem(price.toString(), 2)}`;
      }
    }
    return displayPrice;
  }
  function displayTotalPrice(item: any) {
    const { rewardToken, number, price } = item;
    let resultTotalPrice = '0';
    if (price && price != 'N/A') {
      const totalPrice = new BigNumber(price).multipliedBy(
        toReadableNumber(rewardToken.decimals, number)
      );
      if (new BigNumber('0.01').isGreaterThan(totalPrice)) {
        resultTotalPrice = '<$0.01';
      } else {
        resultTotalPrice = `$${toInternationalCurrencySystem(
          totalPrice.toString(),
          2
        )}`;
      }
    }
    return resultTotalPrice;
  }
  function displayWithDrawTokenNumber(item: any) {
    const { rewardToken, number } = item;
    const tokenNumber = toReadableNumber(rewardToken.decimals, number);
    let resultDisplay = '';
    if (new BigNumber('0.001').isGreaterThan(tokenNumber)) {
      resultDisplay = '<0.001';
    } else {
      resultDisplay = formatWithCommas(
        new BigNumber(tokenNumber).toFixed(3, 1).toString()
      );
    }
    return resultDisplay;
  }
  function clickCheckBox(tokenId: string) {
    if (checkedList[tokenId]) {
      delete checkedList[tokenId];
      if (selectAll) {
        setSelectAll(false);
      }
    } else if (Object.keys(checkedList).length < withdrawNumber) {
      checkedList[tokenId] = { value: rewardList[tokenId].number };
      if (
        Object.keys(checkedList).length ==
        Math.min(withdrawNumber, Object.keys(rewardList).length)
      ) {
        setSelectAll(true);
      }
    }
    setCheckedList(JSON.parse(JSON.stringify(checkedList)));
  }
  function clickAllCheckBox() {
    const status = !selectAll;
    const checkedList = {};
    if (status) {
      const allAtOneTime = Object.entries(rewardList).slice(0, withdrawNumber);
      allAtOneTime.forEach(([key, value]) => {
        checkedList[key] = value.number;
      });
    }
    setCheckedList(checkedList);
    setSelectAll(status);
    rewardRef.current.scrollTop = 0;
  }
  async function doWithDraw() {
    setWithdrawLoading(true);
    withdrawAllReward(checkedList);
  }
  return (
    <div className="absolute w-72  -left-80 rounded-xl overflow-hidden">
      <div className="bg-cardBg" style={{ height: '83px' }}>
        <SnakeImg className="absolute"></SnakeImg>
        <div className="absolute flex flex-col left-16 top-2">
          <label className="text-white text-xs">
            <FormattedMessage id="claimed_Rewards"></FormattedMessage>
          </label>
          <div className="flex items-center mt-1">
            <label className="text-white text-lg font-bold mr-10">
              $109.225
            </label>
            <div
              onClick={switchDetailStatus}
              className="flex items-center text-white text-xs border border-gradientFromHover rounded-xl cursor-pointer h-5 px-4"
            >
              <FormattedMessage id="details" />
              <UpArrowIcon className="ml-2" />
            </div>
          </div>
        </div>
      </div>
      <div
        className={`bg-farmV2WithDrawBg pl-3 pr-6 max-h-96 overflow-auto ${
          showDetail ? '' : 'hidden'
        }`}
        ref={rewardRef}
      >
        {Object.values(rewardList).map((item) => {
          return (
            <div className="flex justify-between py-3.5" key={item.tokenId}>
              <div className="flex items-center text-sm text-white">
                <div
                  className="mr-3 cursor-pointer"
                  onClick={() => {
                    clickCheckBox(item.tokenId);
                  }}
                >
                  {checkedList[item.tokenId] ? (
                    <CheckboxSelected></CheckboxSelected>
                  ) : (
                    <Checkbox></Checkbox>
                  )}
                </div>
                <img
                  src={item.rewardToken.icon}
                  className="w-8 h-8 rounded-full mr-2"
                />
                <div className="flex flex-col">
                  <label className="text-sm text-white">
                    {toRealSymbol(item.rewardToken.symbol)}
                  </label>
                  <label className="text-primaryText text-xs">
                    {displaySinglePrice(item.price)}
                  </label>
                </div>
              </div>
              <div className="flex flex-col text-right">
                <label className="text-sm text-white">
                  {displayWithDrawTokenNumber(item)}
                </label>
                <label className="text-primaryText text-xs">
                  {displayTotalPrice(item)}
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col pt-3 bg-farmV2WithDrawBg pl-3 pr-6  pb-5">
        <div className="flex items-center text-primaryText">
          <label className="mr-3 cursor-pointer" onClick={clickAllCheckBox}>
            {selectAll ? (
              <CheckboxSelected></CheckboxSelected>
            ) : (
              <Checkbox></Checkbox>
            )}
          </label>
          {Object.keys(rewardList).length > withdrawNumber ? (
            <div className="flex items-center ">
              <label className="mr-1">
                <FormattedMessage id="all_5" />
              </label>
              <div
                className="text-white text-right ml-1"
                data-class="reactTip"
                data-for="selectAllId"
                data-place="top"
                data-html={true}
                data-tip={valueOfWithDrawLimitTip()}
              >
                <QuestionMark></QuestionMark>
                <ReactTooltip
                  id="selectAllId"
                  backgroundColor="#1D2932"
                  border
                  borderColor="#7e8a93"
                  effect="solid"
                />
              </div>
            </div>
          ) : (
            <FormattedMessage id="all" />
          )}
        </div>
        <div className="flex justify-center items-center">
          <GradientButton
            color="#fff"
            className={`w-36 h-9 text-center text-base text-white mt-4 focus:outline-none font-semibold ${
              Object.keys(checkedList).length == 0 ? 'opacity-40' : ''
            }`}
            onClick={doWithDraw}
            disabled={Object.keys(checkedList).length == 0}
            btnClassName={
              Object.keys(checkedList).length == 0 ? 'cursor-not-allowed' : ''
            }
            loading={withdrawLoading}
          >
            <div>
              <ButtonTextWrapper
                loading={withdrawLoading}
                Text={() => (
                  <FormattedMessage id="withdraw" defaultMessage="Withdraw" />
                )}
              />
            </div>
          </GradientButton>
        </div>
      </div>
    </div>
  );
}
