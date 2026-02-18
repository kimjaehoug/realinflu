import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPrediction } from '../api/predictionApi';

function safeNumber(n) {
  return Number.isFinite(n) ? n : null;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function computeMetrics(actual, predicted) {
  const absErrors = [];
  const sqErrors = [];
  const ape = [];

  for (let i = 0; i < actual.length; i += 1) {
    const a = safeNumber(actual[i]);
    const p = safeNumber(predicted[i]);
    if (a == null || p == null) continue;
    const e = p - a;
    absErrors.push(Math.abs(e));
    sqErrors.push(e * e);
    if (a !== 0) ape.push(Math.abs(e / a));
  }

  const mae = mean(absErrors);
  const rmse = sqErrors.length ? Math.sqrt(mean(sqErrors)) : null;
  const mape = ape.length ? mean(ape) * 100 : null;

  return {
    count: absErrors.length,
    mae,
    rmse,
    mape,
  };
}

function buildHorizonSeries({ values, perTimestepPreds, windowSize, steps }) {
  const n = values.length;
  const horizons = {};

  for (let h = 1; h <= steps; h += 1) {
    const predicted = new Array(n).fill(null);
    for (let i = 0; i < n; i += 1) {
      const t = i - (h - 1);
      if (t < windowSize) continue;
      // last valid t is n - steps
      if (t > n - steps) continue;
      const predsAtT = perTimestepPreds[t];
      if (!predsAtT || predsAtT.length < h) continue;
      predicted[i] = safeNumber(predsAtT[h - 1]);
    }

    horizons[h] = {
      predicted,
      metrics: computeMetrics(values, predicted),
    };
  }

  return horizons;
}

function getCacheKey({ season, dsid, windowSize, steps }) {
  return `pred_backtest:v1:${dsid}:${season}:w${windowSize}:s${steps}`;
}

/**
 * Rolling backtest hook for prediction model.
 *
 * - Uses history window (default 12) to predict next `steps` points (default 3)
 * - Runs across the whole selected season range (as provided by useInfluenzaData)
 * - Caches results in localStorage to avoid repeated API calls
 */
export function usePredictionBacktest({
  season,
  dsid = 'ds_0101',
  weeks = [],
  values = [],
  windowSize = 12,
  steps = 3,
}) {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const cancelRef = useRef(false);

  const cacheKey = useMemo(() => getCacheKey({ season, dsid, windowSize, steps }), [season, dsid, windowSize, steps]);

  // Load cached result on season change
  useEffect(() => {
    setError(null);
    setStatus('idle');
    setProgress({ current: 0, total: 0 });
    setResult(null);

    if (!season) return;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.result?.horizons && Array.isArray(parsed?.result?.weeks)) {
        setResult(parsed.result);
        setStatus('done');
      }
    } catch (e) {
      // ignore cache parse errors
    }
  }, [cacheKey, season]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const run = useCallback(async () => {
    cancelRef.current = false;
    setError(null);

    if (!season) {
      setError('절기를 선택해 주세요.');
      setStatus('error');
      return;
    }

    if (!Array.isArray(values) || values.length < windowSize + steps) {
      setError('평가를 위한 데이터가 부족합니다.');
      setStatus('error');
      return;
    }

    const n = values.length;
    const total = Math.max(0, (n - steps) - windowSize + 1);
    setProgress({ current: 0, total });
    setStatus('running');

    const perTimestepPreds = {}; // t -> predictions array
    let successCount = 0;
    let failCount = 0;

    for (let t = windowSize; t <= n - steps; t += 1) {
      if (cancelRef.current) break;
      const input = values.slice(t - windowSize, t).map((v) => safeNumber(v)).filter((v) => v != null);
      // if input has missing values, skip
      if (input.length !== windowSize) {
        failCount += 1;
        setProgress((p) => ({ ...p, current: p.current + 1 }));
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const resp = await getPrediction(input, steps);
        const preds = resp?.predictions;
        if (resp?.success && Array.isArray(preds) && preds.length >= 1) {
          perTimestepPreds[t] = preds;
          successCount += 1;
        } else {
          failCount += 1;
        }
      } catch (e) {
        failCount += 1;
      } finally {
        setProgress((p) => ({ ...p, current: p.current + 1 }));
      }
    }

    if (cancelRef.current) {
      setStatus('idle');
      return;
    }

    const horizons = buildHorizonSeries({ values, perTimestepPreds, windowSize, steps });
    const built = {
      season,
      dsid,
      windowSize,
      steps,
      weeks,
      values,
      horizons,
      meta: {
        successCount,
        failCount,
        createdAt: new Date().toISOString(),
      },
    };

    setResult(built);
    setStatus('done');

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ result: built }));
    } catch (e) {
      // ignore
    }
  }, [cacheKey, dsid, season, steps, values, weeks, windowSize]);

  return {
    status,
    error,
    progress,
    result,
    run,
    cancel,
  };
}

