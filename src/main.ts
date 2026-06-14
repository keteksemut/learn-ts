let angka1 = "",
  currentInput = "",
  result = 0,
  operasi = null;

const container = document.createElement("div");
document.body.appendChild(container);

const displayContainer = document.createElement("div");
container?.appendChild(displayContainer);

const display = document.createElement("span");
const displayOperation = document.createElement("span");

displayContainer.appendChild(display);
displayContainer.appendChild(displayOperation);

const operationContainer = document.createElement("div");
container.appendChild(operationContainer);

function continousNum(num) {
  currentInput += num;
  display.textContent = currentInput;
}

function setOperation(ops) {
  if (currentInput !== "") {
    angka1 = Number(currentInput);
  }
  operasi = ops;
  currentInput = "";
  displayOperation.textContent = ops;
}

function resultNum() {
  if (!currentInput) {
    displayOperation.textContent = "missing denominator";
    return;
  }

  if (operasi === "+") {
    result = Number(angka1) + Number(currentInput);
  } else if (operasi === "-") {
    result = Number(angka1) - Number(currentInput);
  } else if (operasi === "x" || operasi === "*" || operasi === "×") {
    result = Number(angka1) * Number(currentInput);
  } else if (operasi === "÷" || operasi === "/") {
    if (currentInput === "0") {
      result = "Undefined";
      display.textContent = result;
      return;
    }
    result = Number(angka1) / Number(currentInput);
  } else {
    display.textContent = "Something error";
    displayOperation.textContent = "";
    return;
  }
  display.textContent = result.toString();
  displayOperation.textContent = "";
  currentInput = "";
  angka1 = "";
  operasi = null;
}

function allClear() {
  angka1 = "";
  currentInput = "";
  result = 0;
  operasi = null;
  display.textContent = "";
  displayOperation.textContent = "";
}

const undoContainer = document.createElement("div");
container.appendChild(undoContainer);

const clearButton = document.createElement("button");
clearButton.textContent = "C";
undoContainer.appendChild(clearButton);
const backChar = document.createElement("button");
backChar.textContent = "< Back";
undoContainer.appendChild(backChar);

clearButton.addEventListener("click", () => {
  allClear();
});

backChar.addEventListener("click", () => {
  backSpace();
});

function backSpace() {
  currentInput = currentInput.slice(0, currentInput.length - 1);
  display.textContent = currentInput;
}

const setOps = ["+", "-", "*", "/"];

setOps.forEach((i) => {
  const opsSymbol = document.createElement("button");
  opsSymbol.textContent = `${i}`;
  operationContainer.appendChild(opsSymbol);

  opsSymbol.addEventListener("click", () => {
    setOperation(`${i}`);
  });
});

const numContainer = document.createElement("div");
container.appendChild(numContainer);

for (let i = 9; i >= 0; i--) {
  const button = document.createElement("button");
  button.id = `button-${i}`;
  button.textContent = `${i}`;
  numContainer?.append(button);

  button.addEventListener("click", () => {
    continousNum(`${i}`);
  });
}

const resultButton = document.createElement("button");
container.appendChild(resultButton);
resultButton.textContent = "=";
resultButton.addEventListener("click", () => {
  resultNum();
});
