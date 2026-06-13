let angka1: string = "",
  currentInput: string = "",
  result: number = 0,
  operation: string | null = null;

const display: HTMLSpanElement = document.createElement("span");
const container = document.querySelector<HTMLDivElement>("#app");

if (container !== null) {
  container.append(display);
}

function updateDom(param: string) {
  currentInput += param;
  display.textContent = currentInput;
}
