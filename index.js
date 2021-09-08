const Status = {
  pending: "pending",
  fulfilled: "success",
  rejected: "rejected",
};

class Future {
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
    if (this.#status === Status.pending) {
      this.#status = Status.success;

      setTimeout(() => {
        try {
          this.#value = value;

          for (let i = 0; i < this.#onfulfilled.length; i++) {
            const fn = this.#onfulfilled[i];
            const nextValue = fn(this.#value);

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
      }, 0);
    }
  };

  #reject = (err) => {
    if (this.#status === Status.pending) {
      this.#status = Status.rejected;
      setTimeout(() => {
        this.#handleReject(err);
        this.#handleFinally();
      }, 0);
    }
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
      throw new Error(`Unhandled rejection: ${err}`);
    }
  };

  #handleFinally = () => {
    for (const fn of this.#onfinally) fn();
  };

  #merge(onfulfilled, onrejected, onfinally) {
    if (onfulfilled.length > 0) {
      this.#onfulfilled = this.#onfulfilled.concat(onfulfilled);
    }
    if (onrejected.length > 0) {
      this.#onrejected = this.#onrejected.concat(onrejected);
    }
    if (onfinally.length > 0) {
      this.#onfinally = this.#onfinally.concat(onfinally);
    }
  }

  then = (onfulfilled, onrejected) => {
    if (typeof onfulfilled === "function") {
      this.#onfulfilled.push(onfulfilled);
    }
    if (typeof onrejected === "function") {
      this.#onrejected.push(onrejected);
    }
    return this;
  };

  catch = (onrejected) => {
    return this.then(null, onrejected);
  };

  finally = (onfinally) => {
    if (typeof onfinally === "function") {
      this.#onfinally.push(onfinally);
    }
    return this;
  };

  static resolve() {
    return new Future((res) => res());
  }

  static reject(reason) {
    return new Future((_, rej) => rej(reason));
  }
}

new Future((resolve) => {
  setTimeout(() => {
    resolve("some data");
  }, 1000);
  console.log("I am first");
})
  .then((val) => {
    console.log(val);
    return new Future((res) => res())
      .then(() => console.log("hello 1"))
      .finally(() => console.log("final 1"));
  })
  .then(() => {
    console.log("hey");
  })
  .catch((err) => {
    console.log(err);
  })
  .finally(() => console.log("final 2"));
