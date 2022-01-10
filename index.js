const Status = {
  pending: "pending",
  fulfilled: "success",
  rejected: "rejected",
};

export class Future {
  #status = Status.pending;
  #value;
  #onfulfilled = [];
  #onrejected = [];
  #onfinally = [];
  #errorsCounter = 0;

  constructor(executor) {
    if (typeof executor !== "function") {
      throw new TypeError("Executor should be a function!");
    }
    try {
      executor(this.#resolve, this.#reject);
    } catch (err) {
      this.#reject(err);
    }
  }

  #resolve = (value) => {
    if (this.#status !== Status.pending) return;
    this.#status = Status.success;
    queueMicrotask(() => {
      try {
        this.#value = value;

        for (let i = 0; i < this.#onfulfilled.length; i++) {
          const nextValue = this.#onfulfilled[i](this.#value);
          if (nextValue instanceof Future) {
            this.#merge.bind(nextValue)(
              this.#onfulfilled.slice(i + 1),
              this.#onrejected,
              this.#onfinally
            );
            this.#onfinally = [];
            break;
          }
          this.#value = nextValue;
        }
      } catch (err) {
        this.#handleReject(err);
      }
      this.#handleFinally();
    });
  };

  #reject = (err) => {
    if (this.#status !== Status.pending) return;
    this.#status = Status.rejected;
    queueMicrotask(() => {
      this.#handleReject(err);
      this.#handleFinally();
    });
  };

  #handleReject = (err) => {
    if (this.#status !== Status.rejected) {
      this.#status = Status.rejected;
    }
    if (this.#onrejected.length > this.#errorsCounter) {
      try {
        this.#onrejected[this.#errorsCounter](err);
      } catch (err) {
        this.#errorsCounter++;
        this.#handleReject(err);
      }
    } else {
      throw new Error(`Unhandled rejection: ${err.message ?? err}`);
    }
  };

  #handleFinally = () => {
    for (const fn of this.#onfinally) fn();
  };

  #merge(onfulfilled, onrejected, onfinally) {
    if (onfulfilled.length > 0) {
      this.#onfulfilled.push(...onfulfilled);
    }
    if (onrejected.length > 0) {
      this.#onrejected.push(...onrejected);
    }
    if (onfinally.length > 0) {
      this.#onfinally.push(...onfinally);
    }
  }

  then = (onfulfilled, onrejected) => {
    if (typeof onfulfilled === "function") {
      this.#onfulfilled.push(onfulfilled);
    } else if (onfulfilled) {
      throw new TypeError("'Onfulfilled' should be a function!");
    }
    if (typeof onrejected === "function") {
      this.#onrejected.push(onrejected);
    } else if (onrejected) {
      throw new TypeError("'Onrejected' should be a function!");
    }
    return this;
  };

  catch = (onrejected) => {
    return this.then(null, onrejected);
  };

  finally = (onfinally) => {
    if (typeof onfinally === "function") {
      this.#onfinally.push(onfinally);
    } else {
      throw new TypeError("'Onfinally' should be a function!");
    }
    return this;
  };

  static resolve = () => {
    return new Future((res) => res());
  }

  static reject = (reason) => {
    return new Future((_, rej) => rej(reason));
  }

  static all = (futures = []) => {
    return new Future((resolve, reject) => {
      let fulfilledCount = 0;
      const values = new Array(futures.length);
      for (let i = 0; i < futures.length; i++) {
        futures[i].then((value) => {
          fulfilledCount++;
          values[i] = value;
          if (fulfilledCount === futures.length) {
            resolve(values);
          }
        }, reject);
      }
    })
  }

  static allSettled = (futures = []) => {
    return new Future((resolve, reject) => {
      let fulfilledCount = 0;
      const values = [];
      const onfulfilled = (value) => {
        fulfilledCount++;
        values.push(value);
        if (fulfilledCount === futures.length) {
          resolve(values);
        }
      }
      for (const future of futures) {
        future.then(onfulfilled, reject);
      }
    })
  }

  static race(futures = []) {
    return new Future((resolve, reject) => {
      for (const future of futures) {
        future.then(resolve, reject);
      }
    })
  }
}
