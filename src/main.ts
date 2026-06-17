let previous: string = "",
  current: string = "",
  operation: "+" | "-" | "*" | "/" | null = null,
  reset: boolean = true;

const MATH_NS: string = "http://www.w3.org/1998/Math/MathML";
type mathTag = "mn" | "mo" | "mi" | "mrow";

const currentExpression = document.getElementById(
  "currentExpression",
) as MathMLElement;

console.log(currentExpression);

function setExpression(type: mathTag, value: number | string): void {
  const newMathML = document.createElementNS(MATH_NS, type);

  newMathML.textContent = value.toString();
  currentExpression.append(newMathML);
}

setExpression("mn", 5);
setExpression("mo", "+");
setExpression("mn", 10);
setExpression("mo", "*");
setExpression("mn", 7);

const result = currentExpression.textContent;
console.log(result);
console.log(result.length);

const token = [];
let currentNumber = "";

for (let i = 0; i <= result.length - 1; i++) {
  if (!isNaN(parseFloat(result[i]))) {
    currentNumber += result[i];
  } else {
    token.push(Number(currentNumber));
    token.push(result[i]);
    currentNumber = "";
  }
}

if (!!currentNumber) {
  token.push(Number(currentNumber));
}

console.log(token);
