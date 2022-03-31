import React, { useEffect, useState, useContext } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Modal from 'react-modal';
import { Card } from '~components/card/Card';
import { ActionModel } from '~pages/AccountPage';
import {
  useMonthTVL,
  useMonthVolume,
  usePool,
  useRemoveLiquidity,
  volumeDataType,
  volumeType,
  TVLDataType,
  TVLType,
  useDayVolume,
} from '~state/pool';
import { Pool, PoolDetails, removePoolFromWatchList } from '~services/pool';

import Loading from '~components/layout/Loading';
import { FarmMiningIcon } from '~components/icon/FarmMining';
import { FarmStamp } from '~components/icon/FarmStamp';
import { ChartLoading } from '~components/icon/Loading';

import {
  calculateFairShare,
  calculateFeePercent,
  percent,
  toNonDivisibleNumber,
  toPrecision,
  toReadableNumber,
  toInternationalCurrencySystem,
  toRoundedReadableNumber,
} from '../../utils/numbers';
import { ftGetTokenMetadata, TokenMetadata } from '~services/ft-contract';

import { toRealSymbol } from '~utils/token';

import { getPool } from '~services/indexer';
import { BigNumber } from 'bignumber.js';
import { FormattedMessage, useIntl } from 'react-intl';

import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  XAxis,
  YAxis,
  Bar,
  Line,
  BarProps,
  Tooltip,
  Cell,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';

import _ from 'lodash';
import moment from 'moment';
import { ChartNoData } from '~components/icon/ChartNoData';
import { WarnTriangle } from '~components/icon/SwapRefresh';
import { RefIcon } from '~components/icon/Common';
import { getCurrentWallet, WalletContext } from '../../utils/sender-wallet';

import { useWalletTokenBalances } from '../../state/token';
import { SmallWallet } from '../../components/icon/SmallWallet';
import { ftGetTokensMetadata } from '../../services/ft-contract';
import { HiOutlineExternalLink } from 'react-icons/hi';
import { StableSwapExchangePC, RateExchanger } from '../icon/Arrows';
import { scientificNotationToString } from '../../utils/numbers';
interface ParamTypes {
  id: string;
}

interface LocationTypes {
  tvl: number;
  backToFarms: boolean;
}
const ONLY_ZEROS = /^0*\.?0*$/;

const formatDate = (rawDate: string) => {
  const date = rawDate
    .split('-')
    .map((t) => (t.length >= 2 ? t : t.padStart(2, '0')))
    .join('-');

  return moment(date).format('ll');
};

const ChartChangeButton = ({
  chartDisplay,
  setChartDisplay,
  className,
  noData,
}: {
  chartDisplay: 'volume' | 'tvl';
  setChartDisplay: (display: 'volume' | 'tvl') => void;
  className?: string;
  noData?: boolean;
}) => {
  const fontSize = '10px';

  return (
    <div
      className={`text-white rounded-xl p-px flex items-center bg-black bg-opacity-20 ${className} ${
        noData ? 'z-20 opacity-70' : ''
      }`}
      style={{
        fontSize: fontSize,
      }}
    >
      <button
        className={`py-0.5 px-1 rounded-xl ${
          chartDisplay === 'tvl' ? 'bg-charBtnBg' : ' text-gray-500'
        }`}
        style={{
          minWidth: '56px',
        }}
        onClick={() => setChartDisplay('tvl')}
      >
        <FormattedMessage id="tvl" defaultMessage="TVL" />
      </button>
      <button
        className={`p-0.5 px-1 rounded-xl ${
          chartDisplay === 'volume' ? ' bg-charBtnBg' : ' text-gray-500'
        }`}
        style={{
          minWidth: '56px',
        }}
        onClick={() => setChartDisplay('volume')}
      >
        <FormattedMessage id="volume" defaultMessage="Volume" />
      </button>
    </div>
  );
};

function EmptyChart({
  chartDisplay,
  setChartDisplay,
  loading,
}: {
  chartDisplay: 'volume' | 'tvl';
  setChartDisplay: (display: 'volume' | 'tvl') => void;
  loading?: boolean;
}) {
  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="pb-7 relative top-4">
        <div className="flex items-center justify-between">
          <div className="text-gray-400 text-2xl float-left">$&nbsp;-</div>
          <ChartChangeButton
            className="self-start"
            noData={true}
            chartDisplay={chartDisplay}
            setChartDisplay={setChartDisplay}
          />
        </div>
        <div className="text-xs text-gray-500">-</div>
      </div>

      {/* layout */}
      <div
        className="absolute w-full left-0 bottom-0 m-auto text-center text-base text-gray-500 flex items-center justify-center opacity-70 z-10"
        style={{
          height: '272px',
          background: '#001320',
        }}
      >
        {loading ? (
          <ChartLoading />
        ) : (
          <div>
            <div>
              <ChartNoData />
            </div>
            <FormattedMessage id="no_data" defaultMessage="No Data" />
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            width: '200px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1px',
            transform: 'rotate(90deg)',
            position: 'relative',
            bottom: '85px',
            left: '200px',
          }}
        />
        <div
          style={{
            borderBottom: '1px solid #ffffff',
            boxSizing: 'border-box',
            width: '10px',
            height: '10px',
            position: 'relative',
            left: '295px',
            top: '4px',
            backgroundColor: '#00d6af',
            opacity: 0.4,
          }}
          className="rounded-full"
        />
        <div className="border-b border-white border-opacity-10 w-full pt-2" />
        <div
          className="flex text-gray-500 justify-between relative top-2"
          style={{
            fontSize: '10px',
          }}
        >
          {[
            '24',
            '31',
            '07',
            '14',
            '21',
            '28',
            '04',
            '11',
            '18',
            '25',
            '02',
            '09',
          ].map((d, i) => {
            return <div key={i}>{d}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-2xl  px-4"
        style={{
          backgroundColor: '#182530',
        }}
      >
        <span className="text-white text-xs pr-2">
          {`$ ${toInternationalCurrencySystem(
            payload?.[0]?.payload?.total_tvl || '0',
            1
          )}`}
        </span>
        <span
          className="text-gray-500"
          style={{
            fontSize: '10px',
          }}
        >
          {formatDate(label).slice(0, -6)}
        </span>
      </div>
    );
  }

  return null;
};

const CustomAxisTip = (props: any) => {
  const { x, y, payload } = props;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="end" fill="#7e8a93" fontSize="10px">
        {payload.value.split('-').pop()}
      </text>
    </g>
  );
};

export function VolumeChart({
  data,
  chartDisplay,
  setChartDisplay,
}: {
  data: volumeDataType[];
  chartDisplay: 'volume' | 'tvl';
  setChartDisplay: (display: 'volume' | 'tvl') => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number>(null);

  const baseColor = '#00967B';
  const hoverColor = '#00c6a2';

  const BackgroundRender = (targetBar: BarProps & { index?: number }) => {
    const { x, y, width, height, index } = targetBar;
    if (index === hoverIndex)
      return (
        <path
          x={x}
          y={y}
          fill="#304452"
          width={width}
          height={height}
          fillOpacity={1}
          className="recharts-rectangle recharts-bar-background-rectangle"
          d={
            'M ' + x + ',5 h ' + width + ' v ' + height + ' h ' + -width + ' Z'
          }
        />
      );
    else
      return (
        <path
          x={x}
          y={y}
          fill="#304452"
          width={width}
          height={height}
          fillOpacity={0}
          className="recharts-rectangle recharts-bar-background-rectangle"
        />
      );
  };

  if (!data)
    return (
      <EmptyChart
        chartDisplay={chartDisplay}
        setChartDisplay={setChartDisplay}
        loading={true}
      />
    );
  if (data.length === 0)
    return (
      <EmptyChart
        chartDisplay={chartDisplay}
        setChartDisplay={setChartDisplay}
      />
    );
  const volumeSum = toInternationalCurrencySystem(
    scientificNotationToString(
      BigNumber.sum(...data.map((d) => d.volume_dollar)).toString()
    )
  );
  return (
    <>
      <div className="flex items-center justify-between self-start w-full relative top-4">
        <div className="flex flex-col">
          <div className="text-white text-2xl">{`$${volumeSum}`}</div>
          <div className="text-xs text-primaryText">
            <FormattedMessage id="Lasting" defaultMessage="Lasting" />
            {` ${data.length} `}
            <FormattedMessage id="Days" defaultMessage="Days" />
          </div>
        </div>
        <ChartChangeButton
          className="self-start"
          chartDisplay={chartDisplay}
          setChartDisplay={setChartDisplay}
        />
      </div>
      <ResponsiveContainer height="90%" width="100%">
        <BarChart
          data={data}
          onMouseMove={(item: any) => setHoverIndex(item.activeTooltipIndex)}
        >
          <XAxis
            dataKey="dateString"
            tickLine={false}
            tickFormatter={(value, index) => value.split('-').pop()}
            axisLine={{
              stroke: 'rgba(255,255,255,0.1)',
            }}
            tick={<CustomAxisTip />}
          />
          <Tooltip
            content={<CustomTooltip />}
            isAnimationActive={false}
            cursor={false}
          />
          <Bar
            dataKey="volume_dollar"
            background={<BackgroundRender dataKey="volume_dollar" />}
          >
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={hoverIndex === i ? hoverColor : baseColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export function TVLChart({
  data,
  chartDisplay,
  setChartDisplay,
}: {
  data: TVLDataType[];
  chartDisplay: 'volume' | 'tvl';
  setChartDisplay: (display: 'volume' | 'tvl') => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number>(null);
  if (!data)
    return (
      <EmptyChart
        setChartDisplay={setChartDisplay}
        chartDisplay={chartDisplay}
        loading={true}
      />
    );

  if (data.length === 0)
    return (
      <EmptyChart
        setChartDisplay={setChartDisplay}
        chartDisplay={chartDisplay}
      />
    );

  const tvlSum = toInternationalCurrencySystem(
    scientificNotationToString(
      BigNumber.sum(...data.map((d) => d.total_tvl)).toString()
    )
  );

  return (
    <>
      <div className="flex items-center justify-between self-start w-full relative top-4">
        <div className="flex flex-col">
          <div className="text-white text-2xl">{`$${tvlSum}`}</div>
          <div className="text-xs text-primaryText">
            <FormattedMessage id="Lasting" defaultMessage="Lasting" />
            {` ${data.length} `}
            <FormattedMessage id="Days" defaultMessage="Days" />
          </div>
        </div>
        <ChartChangeButton
          className="self-start"
          chartDisplay={chartDisplay}
          setChartDisplay={setChartDisplay}
        />
      </div>
      <ResponsiveContainer
        width="100%"
        height="90%"
        className="pool-detail-tvl-chart"
      >
        <ComposedChart
          data={data}
          onMouseMove={(item: any) => {
            setHoverIndex(item.activeTooltipIndex);
          }}
        >
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00c6a2" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00c6a2" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={{
              stroke: 'rgba(255,255,255,0.1)',
            }}
            tickFormatter={(value, index) => value.split('-').pop()}
            tick={<CustomAxisTip />}
          />

          <Tooltip
            isAnimationActive={false}
            cursor={{ opacity: '0.3' }}
            content={<CustomTooltip />}
          />
          <Area
            dataKey="scaled_tvl"
            dot={false}
            stroke="#00c6a2"
            strokeWidth={1}
            fillOpacity={1}
            fill="url(#colorGradient)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </>
  );
}

export const GetExchangeRate = ({
  tokens,
  pool,
}: {
  tokens: TokenMetadata[];
  pool: Pool;
}) => {
  const first_token_num = toReadableNumber(
    tokens[0].decimals || 24,
    pool.supplies[tokens[0].id]
  );
  const second_token_num = toReadableNumber(
    tokens[1].decimals || 24,
    pool.supplies[tokens[1].id]
  );
  const rate = Number(second_token_num) / Number(first_token_num);

  const showRate = rate < 0.01 ? '< 0.01' : rate.toFixed(2);

  return Number(first_token_num) === 0 ? (
    <div className="px-1 border border-transparent">&nbsp;</div>
  ) : (
    <div className="text-farmText text-center px-1 text-sm">
      <span>
        1&nbsp;{toRealSymbol(tokens[0].symbol)}&nbsp;
        <span title={`${rate}`}>
          {rate < 0.01 ? '' : '='} {showRate}
        </span>
        &nbsp;{toRealSymbol(tokens[1].symbol)}
      </span>
    </div>
  );
};

// get pool info from parent component
export function PoolDetail({
  pool,
  showDetail,
}: {
  pool: Pool;
  showDetail?: boolean;
}) {
  // const { pool } = usePool(id);

  const [tokens, setTokens] = useState<{
    [poolId: string]: TokenMetadata;
  }>();

  const [chartDisplay, setChartDisplay] = useState<'volume' | 'tvl'>('tvl');
  const monthVolume = useMonthVolume(pool?.id.toString());
  const monthTVL = useMonthTVL(pool?.id.toString());

  const [poolTVL, setPoolTVL] = useState<number>();
  const dayVolume = useDayVolume(pool?.id.toString());

  useEffect(() => {
    getPool(String(pool?.id)).then((pool) => {
      setPoolTVL(pool?.tvl);
    });
  }, [pool?.id]);

  const [rateReverse, setRateReverse] = useState<boolean>(false);

  useEffect(() => {
    if (!pool) return;
    ftGetTokensMetadata(pool?.tokenIds).then(setTokens);
  }, [pool]);

  if (!tokens) return <Loading />;

  const Header = () => {
    return (
      <div className="flex items-center justify-between w-full pb-4">
        <div className="text-white text-lg flex items-center">
          {Object.values(tokens).map((t, i) => {
            return (
              <span key={i}>
                {i ? '-' : ''}
                {toRealSymbol(t.symbol)}
              </span>
            );
          })}
          <span
            className="ml-2 cursor-pointer"
            onClick={() => {
              window.open(`/pool/${pool.id}`);
            }}
          >
            <HiOutlineExternalLink color="#00AB07" />
          </span>
        </div>

        <div
          className={`flex items-center ${
            Number(pool.shareSupply) > 0 ? 'block' : 'hidden'
          }`}
        >
          <GetExchangeRate
            tokens={
              rateReverse
                ? Object.values(tokens).slice().reverse()
                : Object.values(tokens)
            }
            pool={pool}
          />

          <RateExchanger
            onChange={() => {
              setRateReverse(!rateReverse);
            }}
          />
        </div>
      </div>
    );
  };

  const TokenIdRender = ({
    id,
    tokenIds,
  }: {
    id: string;
    tokenIds: string[];
  }) => {
    return (
      <a
        target="_blank"
        href={`/swap/#${tokenIds[0]}|${tokenIds[1]}`}
        className="text-xs text-primaryText"
        title={id}
      >{`${id.substring(0, 24)}${id.length > 24 ? '...' : ''}`}</a>
    );
  };

  const PoolTokenInfo = ({
    token,
    pool,
  }: {
    token: TokenMetadata;
    pool: Pool;
  }) => {
    if (!token) return null;

    const tokenSupply = toReadableNumber(
      token.decimals,
      pool.supplies[token.id]
    );

    const displayTokenSupply =
      Number(tokenSupply) < 0.01 && Number(tokenSupply) > 0
        ? '< 0.01'
        : toInternationalCurrencySystem(tokenSupply);

    return (
      <div className="bg-black bg-opacity-20 rounded-lg px-5 py-2 flex items-center justify-between text-sm">
        <div className=" flex flex-col text-primaryText">
          <span>{toRealSymbol(token.symbol)}</span>
          <span>
            <TokenIdRender id={token.id} tokenIds={pool.tokenIds} />
          </span>
        </div>

        <span className="text-white text-base" title={tokenSupply}>
          {displayTokenSupply}
        </span>
      </div>
    );
  };

  const DetailInfo = ({
    title,
    value,
    valueTitle,
  }: {
    title: string | JSX.Element;
    value: string;
    valueTitle?: string;
  }) => {
    return (
      <div className="flex items-center flex-col xs:flex-row  justify-center xs:justify-between text-sm xs:w-full">
        <span className="text-primaryText ">{title}</span>

        <span className="text-white" title={valueTitle}>
          {value}
        </span>
      </div>
    );
  };

  return (
    <Card
      padding="px-6 pt-8 pb-6"
      width="w-full"
      className={`mx-auto flex flex-col relative bottom-10 ${
        showDetail ? 'block' : 'hidden'
      }`}
    >
      <Header />

      <div className="flex xs:flex-col items-center justify-between w-full">
        <div className="mr-2 xs:mr-0 w-full">
          <PoolTokenInfo token={tokens?.[pool.tokenIds[0]]} pool={pool} />
        </div>
        <div className="ml-2 xs:ml-0 xs:mt-2 w-full">
          <PoolTokenInfo token={tokens?.[pool.tokenIds[1]]} pool={pool} />
        </div>
      </div>

      <div className="flex items-center justify-between xs:flex-col w-full py-5">
        <DetailInfo
          title={<FormattedMessage id="fee" defaultMessage="Fee" />}
          value={`${calculateFeePercent(pool.fee)}%`}
        />
        <DetailInfo
          title={<FormattedMessage id="tvl" defaultMessage="TVL" />}
          value={`$ ${toInternationalCurrencySystem(poolTVL?.toString())}`}
          valueTitle={
            Number(poolTVL || '0') < 0.01
              ? '< 0.01'
              : toPrecision(poolTVL?.toString(), 0)
          }
        />
        <DetailInfo
          title={
            <FormattedMessage id="h24_volume" defaultMessage="24h volume" />
          }
          value={dayVolume ? toInternationalCurrencySystem(dayVolume) : '-'}
        />
        <DetailInfo
          title={
            <FormattedMessage
              id="total_lp_tokens"
              defaultMessage="Total LP tokens"
            />
          }
          value={toInternationalCurrencySystem(
            toReadableNumber(24, pool?.shareSupply || '0')
          )}
        />
      </div>

      <div className="w-full border border-black opacity-20"></div>

      <div
        className={`w-full ${
          monthTVL?.length || monthVolume?.length ? 'block' : 'hidden'
        }`}
        style={{
          height: '300px',
        }}
      >
        {chartDisplay === 'tvl' && monthTVL && monthTVL.length ? (
          <TVLChart
            data={monthTVL}
            chartDisplay={chartDisplay}
            setChartDisplay={setChartDisplay}
          />
        ) : null}
        {chartDisplay === 'volume' && monthVolume && monthVolume.length ? (
          <VolumeChart
            data={monthVolume}
            chartDisplay={chartDisplay}
            setChartDisplay={setChartDisplay}
          />
        ) : null}
      </div>
    </Card>
  );
}
