function celsiusToFahrenheit(celsius) {
  return celsius * (9 / 5) + 32;
}

function fahrenheitToCelsius(fahrenheit) {
  return (fahrenheit - 32) * (5 / 9);
}

function formatTemperature(value, unit) {
  if (value === undefined || value === null || !unit) {
    return "Enter Value and Unit";
  }
  const norm = unit.toUpperCase();
  if (norm !== "F" && norm !== "C") return `Unit should either F or C`;

  if (norm === "F") {
    return `${value} F`;
  } else {
    return `${value} C`;
  }
}

const fahrenheit = celsiusToFahrenheit(25);
console.log(formatTemperature(fahrenheit, "F"));
const celsius = fahrenheitToCelsius(68);
console.log(formatTemperature(celsius, "C"));
const freezingFahrenheit = celsiusToFahrenheit(0);
console.log(formatTemperature(freezingFahrenheit, "F"));
const freezingCelsius = fahrenheitToCelsius(32);
console.log(formatTemperature(freezingCelsius, "C"));
