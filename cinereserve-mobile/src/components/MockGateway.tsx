import { useEffect, useRef, useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import {
  alertCircleOutline,
  arrowBackOutline,
  cardOutline,
  closeOutline,
  lockClosedOutline,
  phonePortraitOutline,
} from 'ionicons/icons';
import {
  TEST_CARD_DECLINED,
  TEST_CARD_OK,
  TEST_OTP,
  type CardErrors,
  cardBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  formatMobile,
  isDeclinedCard,
  mobileValid,
  validateCard,
} from '../lib/mockGateway';
import './MockGateway.css';

type Step = 'details' | 'otp' | 'processing';

interface MockGatewayProps {
  method: 'gcash' | 'card';
  /** Display amount, e.g. "₱375.00" — the real amount is the backend's. */
  amount: string;
  reference: string;
  /** Settles the payment for real; resolves false when it failed. */
  onAuthorize: () => Promise<boolean>;
  onClose: () => void;
}

// Feels like a round trip to a bank without making the demo slow.
const PROCESSING_MS = 1400;

/**
 * Hosted-checkout lookalike for demos. Card and wallet details stay in
 * this component's state and are never sent anywhere; only a successful
 * "authorization" calls onAuthorize, which records the simulated payment.
 */
const MockGateway: React.FC<MockGatewayProps> = ({ method, amount, reference, onAuthorize, onClose }) => {
  const [step, setStep] = useState<Step>('details');
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' });
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const processing = step === 'processing';

  useEffect(() => {
    if (processing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [processing, onClose]);

  const runProcessing = (declined: boolean) => {
    setBanner(null);
    setStep('processing');
    timerRef.current = setTimeout(async () => {
      if (declined) {
        setStep('details');
        setBanner('Your card was declined. Try a different card.');
        return;
      }
      const ok = await onAuthorize();
      if (!ok) {
        setStep('details');
        setBanner("The payment didn't go through. Please try again.");
      }
    }, PROCESSING_MS);
  };

  const submitCard = (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateCard(card);
    setCardErrors(errors);
    if (Object.keys(errors).length === 0) runProcessing(isDeclinedCard(card.number));
  };

  const submitMobile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!mobileValid(mobile)) {
      setFieldError('Enter an 11-digit mobile number starting with 09.');
      return;
    }
    setFieldError(null);
    setOtp('');
    setStep('otp');
  };

  const submitOtp = (event: React.FormEvent) => {
    event.preventDefault();
    if (otp !== TEST_OTP) {
      setFieldError('Incorrect code. Check the test code below.');
      return;
    }
    setFieldError(null);
    runProcessing(false);
  };

  const brand = cardBrand(card.number);
  const isCard = method === 'card';

  return (
    <div className="gw" onClick={() => !processing && onClose()}>
      <div className="gw__backdrop" />
      <div
        className="gw__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gw-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="gw__header">
          {step === 'otp' ? (
            <button
              type="button"
              className="gw__icon-btn"
              aria-label="Change mobile number"
              onClick={() => {
                setFieldError(null);
                setStep('details');
              }}
            >
              <IonIcon icon={arrowBackOutline} />
            </button>
          ) : (
            <span className="gw__lock" aria-hidden="true">
              <IonIcon icon={lockClosedOutline} />
            </span>
          )}
          <div className="gw__brand">
            <strong id="gw-title">CineReserve Pay</strong>
            <span>Secure checkout · Test mode</span>
          </div>
          <button
            type="button"
            className="gw__icon-btn"
            aria-label="Cancel payment"
            disabled={processing}
            onClick={onClose}
          >
            <IonIcon icon={closeOutline} />
          </button>
        </header>

        <div className="gw__amount">
          <span>Amount due</span>
          <strong>{amount}</strong>
          <small>Ref {reference}</small>
        </div>

        {banner && (
          <div className="gw__banner" role="alert">
            <IonIcon icon={alertCircleOutline} aria-hidden="true" />
            <span>{banner}</span>
          </div>
        )}

        {processing ? (
          <div className="gw__processing" role="status">
            <IonSpinner name="crescent" />
            <strong>{isCard ? 'Contacting your bank…' : 'Confirming with your wallet…'}</strong>
            <span>Please don't close this screen.</span>
          </div>
        ) : isCard ? (
          <form className="gw__form" onSubmit={submitCard} noValidate>
            <label className="gw__field">
              <span>Card number</span>
              <div className={`gw__input${cardErrors.number ? ' gw__input--error' : ''}`}>
                <IonIcon icon={cardOutline} aria-hidden="true" />
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="1234 5678 9012 3456"
                  value={card.number}
                  onChange={(e) => setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))}
                />
                {brand && <em className="gw__brand-tag">{brand}</em>}
              </div>
              {cardErrors.number && <small className="gw__error">{cardErrors.number}</small>}
            </label>

            <div className="gw__row">
              <label className="gw__field">
                <span>Expiry</span>
                <div className={`gw__input${cardErrors.expiry ? ' gw__input--error' : ''}`}>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="MM/YY"
                    value={card.expiry}
                    onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                  />
                </div>
                {cardErrors.expiry && <small className="gw__error">{cardErrors.expiry}</small>}
              </label>
              <label className="gw__field">
                <span>CVC</span>
                <div className={`gw__input${cardErrors.cvc ? ' gw__input--error' : ''}`}>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="123"
                    value={card.cvc}
                    onChange={(e) => setCard((c) => ({ ...c, cvc: digitsOnly(e.target.value).slice(0, 4) }))}
                  />
                </div>
                {cardErrors.cvc && <small className="gw__error">{cardErrors.cvc}</small>}
              </label>
            </div>

            <label className="gw__field">
              <span>Name on card (optional)</span>
              <div className="gw__input">
                <input
                  autoComplete="off"
                  placeholder="Juan Dela Cruz"
                  value={card.name}
                  onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                />
              </div>
            </label>

            <button type="submit" className="gw__pay">
              Pay {amount}
            </button>

            <div className="gw__hint">
              <strong>Test cards</strong>
              <button type="button" onClick={() => setCard((c) => ({ ...c, number: TEST_CARD_OK }))}>
                {TEST_CARD_OK} <em>succeeds</em>
              </button>
              <button type="button" onClick={() => setCard((c) => ({ ...c, number: TEST_CARD_DECLINED }))}>
                {TEST_CARD_DECLINED} <em>declined</em>
              </button>
              <span>Any future expiry and any 3-digit CVC.</span>
            </div>
          </form>
        ) : step === 'details' ? (
          <form className="gw__form" onSubmit={submitMobile} noValidate>
            <label className="gw__field">
              <span>GCash mobile number</span>
              <div className={`gw__input${fieldError ? ' gw__input--error' : ''}`}>
                <IonIcon icon={phonePortraitOutline} aria-hidden="true" />
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0917 123 4567"
                  value={mobile}
                  onChange={(e) => setMobile(formatMobile(e.target.value))}
                />
              </div>
              {fieldError && <small className="gw__error">{fieldError}</small>}
            </label>

            <button type="submit" className="gw__pay">
              Send code
            </button>

            <div className="gw__hint">
              <strong>Test mode</strong>
              <span>Any 09XXXXXXXXX number works. No text message is sent.</span>
            </div>
          </form>
        ) : (
          <form className="gw__form" onSubmit={submitOtp} noValidate>
            <p className="gw__lead">
              Enter the 6-digit code sent to <strong>{mobile}</strong>.
            </p>
            <label className="gw__field">
              <span>Verification code</span>
              <div className={`gw__input gw__input--otp${fieldError ? ' gw__input--error' : ''}`}>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(digitsOnly(e.target.value).slice(0, 6))}
                  autoFocus
                />
              </div>
              {fieldError && <small className="gw__error">{fieldError}</small>}
            </label>

            <button type="submit" className="gw__pay" disabled={otp.length !== 6}>
              Pay {amount}
            </button>

            <div className="gw__hint">
              <strong>Test code</strong>
              <button type="button" onClick={() => setOtp(TEST_OTP)}>
                {TEST_OTP} <em>tap to fill</em>
              </button>
            </div>
          </form>
        )}

        <p className="gw__foot">
          <IonIcon icon={lockClosedOutline} aria-hidden="true" />
          Simulated gateway: no real money moves and details are never sent.
        </p>
      </div>
    </div>
  );
};

export default MockGateway;
