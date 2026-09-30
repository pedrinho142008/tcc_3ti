const inFlight = new Map();

export function withLoginLock(key, fn) {
  if (inFlight.has(key)) {
    console.log(`⏳ [lock] Login já em andamento para ${key}, reaproveitando...`);
    return inFlight.get(key);
  }

  const p = (async () => {
    try {
      return await fn();
    } finally {
      setTimeout(() => inFlight.delete(key), 200);
    }
  })();

  inFlight.set(key, p);
  return p;
}

export function loginEmAndamento(key) {
  return inFlight.has(key);
}
