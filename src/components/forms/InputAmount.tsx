import React, { useEffect, useRef, useState } from 'react';
import { TokenMetadata } from '~services/ft-contract';
import { TokenBalancesView } from '~services/token';

interface InputAmountProps extends React.InputHTMLAttributes<HTMLInputElement> {
  max?: string;
  maxBorder?: boolean;
  showMaxAsBalance?: boolean;
  onChangeAmount?: (amount: string, balances?: TokenBalancesView) => void;
  tokenSymbol?: string;
}

export default function InputAmount({
  max,
  className,
  onChangeAmount,
  disabled = false,
  maxBorder = true,
  ...rest
}: InputAmountProps) {
  const ref = useRef<HTMLInputElement>();
  const field = useRef<HTMLFieldSetElement>();
  const [symbolsArr] = useState(['e', 'E', '+', '-']);

  const [isFocus, setIsFocus] = useState<boolean>(false);

  const handleChange = (amount: string) => {
    if (onChangeAmount) onChangeAmount(amount);

    ref.current.value = amount;
  };

  return (
    <>
      <fieldset
        className={`${className} ${
          isFocus
            ? ' border border-greenLight rounded'
            : ' border border-transparent rounded'
        }`}
        ref={field}
      >
        <div
          className={`relative flex align-center items-center bg-inputDarkBg rounded`}
        >
          <input
            ref={ref}
            max={max}
            min="0"
            onWheel={() => ref.current.blur()}
            {...rest}
            step="any"
            className={`xs:text-sm text-lg font-bold w-full p-2 ${
              disabled ? 'text-gray-200 placeholder-gray-200' : 'text-white'
            }`}
            type="number"
            placeholder="0.0"
            onChange={({ target }) => handleChange(target.value)}
            disabled={disabled}
            onKeyDown={(e) => symbolsArr.includes(e.key) && e.preventDefault()}
            onFocus={() => {
              setIsFocus(true);
            }}
            onBlur={() => {
              setIsFocus(false);
            }}
          />
          {max ? (
            <a
              className={`rounded border  items-center px-1 mr-2 m-auto focus:outline-none text-xs ${
                disabled || max === rest.value
                  ? 'text-gray-400 hover:text-gray-400 border-gray-400'
                  : 'text-greenColor border-greenColor'
              }`}
              style={{ lineHeight: 'unset', cursor: 'pointer' }}
              onClick={() => handleChange(max)}
            >
              MAX
            </a>
          ) : null}
        </div>
      </fieldset>
    </>
  );
}

export function NewFarmInputAmount({
  max,
  className,
  onChangeAmount,
  disabled = false,
  maxBorder = true,
  tokenSymbol,
  ...rest
}: InputAmountProps) {
  const ref = useRef<HTMLInputElement>();
  const field = useRef<HTMLFieldSetElement>();
  const [symbolsArr] = useState(['e', 'E', '+', '-']);

  const [isFocus, setIsFocus] = useState<boolean>(false);

  const handleChange = (amount: string) => {
    if (onChangeAmount) onChangeAmount(amount);

    ref.current.value = amount;
  };

  return (
    <fieldset
      className={`${className} ${
        isFocus
          ? ' border border-greenLight rounded-lg'
          : ' border border-transparent rounded-lg'
      }`}
      ref={field}
    >
      <div
        className={`relative flex align-center items-center bg-inputDarkBg rounded-lg pr-5 `}
      >
        <input
          ref={ref}
          max={max}
          min="0"
          onWheel={() => ref.current.blur()}
          {...rest}
          step="any"
          className={`xs:text-sm text-lg font-bold w-full px-5 py-4 ${
            disabled ? 'text-gray-200 placeholder-gray-200' : 'text-white'
          }`}
          type="number"
          placeholder="0.0"
          onChange={({ target }) => handleChange(target.value)}
          disabled={disabled}
          onKeyDown={(e) => symbolsArr.includes(e.key) && e.preventDefault()}
          onFocus={() => {
            setIsFocus(true);
          }}
          onBlur={() => {
            setIsFocus(false);
          }}
        />
        <span className="flex items-center">
          <a
            className={`rounded-lg text-farmText border border-smBtnBorder hover:bg-smBtnBorder items-center px-1.5 py-1 m-auto focus:outline-none text-xs `}
            style={{ lineHeight: 'unset', cursor: 'pointer' }}
            onClick={() => handleChange(max)}
          >
            <span>MAX</span>
          </a>
          <span className="text-base font-bold text-white ml-3">
            {tokenSymbol}
          </span>
        </span>
      </div>
    </fieldset>
  );
}
