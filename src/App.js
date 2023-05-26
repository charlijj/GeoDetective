import React, { useState, useRef } from "react";
import "./App.css";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import pinIcon from "./marker-icon.png";
import { Country, State, City } from "country-state-city";
import { getPopulationByCountryAndYear } from "world-countries-population-data";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function App() {
  // Map code ---------------------------------------------------

  const mapRef = useRef(null);

  const [mapState, setMapState] = useState({
    center: [0, 0],
    zoom: 2,
  });

  function handleMapChange(center, zoom) {
    setMapState({ center, zoom });
    if (mapRef.current) {
      mapRef.current.setView(center, zoom);
    }
  }

  const pin = new L.Icon({
    iconUrl: pinIcon,
    iconRetinaUrl: pinIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  // ============================================================

  async function main() {
    const Countries = Country.getAllCountries();
    const States = State.getAllStates();
    const Cities = City.getAllCities();

    let possibleCountries = [];
    let possibleStates = [];
    let possibleCities = [];

    const Guess = {
      currGuess: 0,
      correctCountry: false,
      correctState: false,
      correctCity: false,
      lat: 0,
      long: 0,
      zoom: 2,
      country: "",
      countryName: "",
      flag: "",
      state: "",
      stateName: "",
      city: "",
    };

    const Questions = [
      `Is your city in the Western Hemisphere`, //  0
      `Is your city in the Northern Hemisphere`, //  1
      `Is your city's country's population > 10,000,000`, //  2
      `Does your city's country begin with the letter `, //  3
      `Is your city's country `, //  4
      `Is your city's country's capital South of `, //  5
      `Is your city's country's capital West of `, //  6
      `Is your city's state or province `, //  7
      `Is your city's state or province's capital South of `, //  8
      `Is your city's state or province's capital West of `, //  9
      `Does your city begin with the letter `, //  10
      `Is your city `, //  11
      `Is your city South of `, //  12
      `Is your city West of `, //  13
    ];

    const Question = document.getElementById("Question");
    const yesButton = document.getElementById("yes");
    const noButton = document.getElementById("no");
    const currGuess = document.getElementById("currGuess");

    const countryLabel = document.getElementById("country");
    const stateLabel = document.getElementById("state");
    const cityLabel = document.getElementById("city");

    function findMiddle(placeList) {
      let avgLat = 0;
      let avgLong = 0;

      for (let i = 0; i < placeList.length; i++) {
        avgLat += parseFloat(placeList[i].latitude);
        avgLong += parseFloat(placeList[i].longitude);
      }
      avgLat /= placeList.length;
      avgLong /= placeList.length;

      let minDist = Infinity;
      let middleCountry;
      for (let i = 0; i < placeList.length; i++) {
        let dist = Math.sqrt(
          Math.pow(parseFloat(placeList[i].latitude) - avgLat, 2) +
            Math.pow(parseFloat(placeList[i].longitude) - avgLong, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          middleCountry = placeList[i];
        }
      }
      if (!middleCountry) {
        middleCountry = placeList[0];
      }

      return middleCountry;
    }

    function getMostCommonLetter(placeList) {
      const frequency = {};
      let mostCommonLetter;
      let highestCount = 0;

      for (let i = 0; i < placeList.length; i++) {
        const firstLetter = placeList[i].name[0];
        if (!frequency[firstLetter]) {
          frequency[firstLetter] = 0;
        }
        frequency[firstLetter]++;
        if (frequency[firstLetter] > highestCount) {
          highestCount = frequency[firstLetter];
          mostCommonLetter = firstLetter;
        }
      }

      return mostCommonLetter;
    }

    async function guessCountry() {
      let correct;

      // get hemispheres -------------------------------------
      updateGuess(Questions[0]);
      Guess.currGuess++;
      correct = await guess();
      if (correct) {
        Guess.long = -90;
      } else {
        Guess.long = 90;
      }

      updateGuess(Questions[1]);
      Guess.currGuess++;
      correct = await guess();
      if (correct) {
        Guess.lat = 30;
      } else {
        Guess.lat = -30;
      }

      // get countries in matching hemispheres and add it to possibleCountries
      for (let i = 0; i < Countries.length; i++) {
        const country = Countries[i];
        if (
          Math.sign(country.longitude) === Math.sign(Guess.long) &&
          Math.sign(country.latitude) === Math.sign(Guess.lat)
        ) {
          possibleCountries.push(country);
        }
      }

      // ------------------------------------------------------

      // Get Population ---------------------------------------
      const year = "2020";
      updateGuess(Questions[2]);
      Guess.currGuess++;
      correct = await guess();
      for (let i = possibleCountries.length - 1; i >= 0; i--) {
        const country = possibleCountries[i];
        try {
          const population = getPopulationByCountryAndYear(country.name, year);
          if (
            (correct && population < 10000000) ||
            (!correct && population > 10000000)
          ) {
            possibleCountries.splice(i, 1);
          }
        } catch (error) {
          possibleCountries.splice(i, 1);
        }
      }
      // ------------------------------------------------------

      // Get First Letter -------------------------------------
      let mostCommonLetter = getMostCommonLetter(possibleCountries);

      updateGuess(Questions[3] + mostCommonLetter.toUpperCase());
      Guess.currGuess++;
      correct = await guess();
      for (let i = possibleCountries.length - 1; i >= 0; i--) {
        const country = possibleCountries[i];
        if (
          (correct && country.name[0] !== mostCommonLetter) ||
          (!correct && country.name[0] === mostCommonLetter)
        ) {
          possibleCountries.splice(i, 1);
        }
      }
      // ------------------------------------------------------

      let iteration = 0;
      Guess.zoom = 3;
      while (!Guess.correctCountry) {
        let middleCountry = findMiddle(possibleCountries);
        Guess.lat = middleCountry.latitude;
        Guess.long = middleCountry.longitude;

        updateGuess(Questions[4] + middleCountry.name);
        Guess.currGuess++;
        correct = await guess();
        if (correct) {
          Guess.correctCountry = true;
          Guess.country = middleCountry.isoCode;
          Guess.countryName = middleCountry.name;
          Guess.flag = middleCountry.flag;
          updateGuess("Your Country Is " + middleCountry.name + "!");
        } else {
          const midLat = parseFloat(middleCountry.latitude);
          const midLong = parseFloat(middleCountry.longitude);

          // alternate whether to ask if countries is south or west of current guess
          let q;
          if (iteration % 2 === 0) {
            q = 5; // Is your city's country South of
          } else {
            q = 6; // Is your city's country West of
          }
          iteration++;

          updateGuess(Questions[q] + middleCountry.name);
          Guess.currGuess++;
          correct = await guess();

          for (let i = possibleCountries.length - 1; i >= 0; i--) {
            if (possibleCountries.length === 1) {
              Guess.correctCountry = true;
              Guess.country = possibleCountries[0].isoCode;
              Guess.countryName = possibleCountries[0].name;
              Guess.flag = possibleCountries[0].flag;
              updateGuess("Your Country Is " + possibleCountries[0].name + "!");
              break;
            }

            const country = possibleCountries[i];
            const lat = parseFloat(country.latitude);
            const long = parseFloat(country.longitude);

            if (
              (q === 6 &&
                ((correct && long >= midLong) ||
                  (!correct && long <= midLong))) ||
              (q === 5 &&
                ((correct && lat >= midLat) || (!correct && lat <= midLat)))
            ) {
              possibleCountries.splice(i, 1);
            }
          }
        }
      }
      return;
    }

    async function guessState() {
      let correct;

      for (let i = 0; i < States.length; i++) {
        if (Guess.country === States[i].countryCode) {
          possibleStates.push(States[i]);
        }
      }

      // if country has no states
      if (possibleStates.length === 0) {
        console.log("no possible states");
        return;
      }

      let iteration = 0;
      Guess.zoom = 5;
      while (!Guess.correctState) {
        let middleState = await findMiddle(possibleStates);

        if (middleState.latitude && middleState.longitude) {
          Guess.lat = middleState.latitude;
          Guess.long = middleState.longitude;
        }

        updateGuess(Questions[7] + middleState.name);
        Guess.currGuess++;
        correct = await guess();
        if (correct) {
          Guess.correctState = true;
          Guess.state = middleState.isoCode;
          Guess.stateName = middleState.name;
          updateGuess("Your state or provence is " + middleState.name + "!");
        } else {
          const midLat = parseFloat(middleState.latitude);
          const midLong = parseFloat(middleState.longitude);

          // alternate whether to ask if countries is south or west of current guess
          let q;
          if (iteration % 2 === 0) {
            q = 8; // Is your city's state or provence South of
          } else {
            q = 9; // Is your city's state or provence West of
          }
          iteration++;

          updateGuess(Questions[q] + middleState.name);
          Guess.currGuess++;
          correct = await guess();

          for (let i = possibleStates.length - 1; i >= 0; i--) {
            if (possibleStates.length === 1) {
              Guess.correctState = true;
              Guess.state = possibleStates[0].isoCode;
              Guess.stateName = possibleStates[0].name;
              updateGuess(
                "Your State or provence is " + possibleStates[0].name + "!"
              );
              break;
            }

            const state = possibleStates[i];
            const lat = parseFloat(state.latitude);
            const long = parseFloat(state.longitude);

            if (
              (q === 9 &&
                ((correct && long > midLong) ||
                  (!correct && long < midLong))) ||
              (q === 8 &&
                ((correct && lat > midLat) || (!correct && lat < midLat))) ||
              middleState.name === state.name
            ) {
              possibleStates.splice(i, 1);
            }
          }
        }
      }
      return;
    }

    async function guessCity() {
      let correct;

      for (let i = 0; i < Cities.length; i++) {
        if (
          Guess.country === Cities[i].countryCode &&
          Guess.state === Cities[i].stateCode
        ) {
          possibleCities.push(Cities[i]);
        }
      }

      // country has no cities
      if (possibleCities.length === 0) {
        console.log("no possible cities");
        updateGuess("");
        return;
      }

      // Get First Letter -------------------------------------
      let mostCommonLetter = getMostCommonLetter(possibleCities);
      mostCommonLetter = mostCommonLetter.toUpperCase();
      updateGuess(Questions[10] + mostCommonLetter);
      Guess.currGuess++;
      correct = await guess();
      for (let i = possibleCities.length - 1; i >= 0; i--) {
        const city = possibleCities[i];
        if (
          (correct && city.name[0] !== mostCommonLetter) ||
          (!correct && city.name[0] === mostCommonLetter)
        ) {
          possibleCities.splice(i, 1);
        }
      }

      let iteration = 0;
      Guess.zoom = 8;
      while (!Guess.correctCity) {
        let middleCity = findMiddle(possibleCities);
        Guess.lat = middleCity.latitude;
        Guess.long = middleCity.longitude;

        updateGuess(Questions[11] + middleCity.name);
        Guess.currGuess++;
        correct = await guess();
        if (correct) {
          Guess.correctCity = true;
          Guess.city = middleCity.name;
        } else {
          const midLat = parseFloat(middleCity.latitude);
          const midLong = parseFloat(middleCity.longitude);

          // alternate whether to ask if countries is south or west of current guess
          let q;
          if (iteration % 2 === 0) {
            q = 12; // Is your city South of
          } else {
            q = 13; // Is your city West of
          }
          iteration++;

          updateGuess(Questions[q] + middleCity.name);
          Guess.currGuess++;
          correct = await guess();

          for (let i = possibleCities.length - 1; i >= 0; i--) {
            if (possibleCities.length === 1) {
              Guess.correctCity = true;
              Guess.city = possibleCities[0].name;
              break;
            }

            const city = possibleCities[i];
            const lat = parseFloat(city.latitude);
            const long = parseFloat(city.longitude);

            if (
              (q === 13 &&
                ((correct && long > midLong) ||
                  (!correct && long < midLong))) ||
              (q === 12 &&
                ((correct && lat > midLat) || (!correct && lat < midLat))) ||
              middleCity.name === city.name
            ) {
              possibleCities.splice(i, 1);
            }
          }
        }
      }
      gameComplete();
    }

    // ---------------------------------------------------------------
    function guess() {
      return new Promise((resolve) => {
        yesButton.addEventListener("click", () => {
          resolve(true);
        });

        noButton.addEventListener("click", () => {
          resolve(false);
        });
      });
    }
    // ---------------------------------------------------------------

    // ---------------------------------------------------------------
    function updateGuess(guess) {
      Question.innerHTML = guess + "?";
      currGuess.innerHTML = Guess.currGuess;
      countryLabel.innerHTML = Guess.countryName + "<br/>" + Guess.flag;
      stateLabel.innerHTML = Guess.stateName;
      handleMapChange([Guess.lat, Guess.long], Guess.zoom);
    }
    // ---------------------------------------------------------------

    function gameComplete() {
      const buttonContainer = document.getElementById("buttonContainer");
      while (buttonContainer.firstChild) {
        buttonContainer.removeChild(buttonContainer.firstChild);
      }
      Question.innerHTML =
        "Your city is " +
        Guess.city +
        "!" +
        "<br/>" +
        "Got it in " +
        Guess.currGuess +
        " guesses.";
      cityLabel.innerHTML = Guess.city;
      currGuess.innerHTML = Guess.currGuess;

      const playAgain = document.createElement("div");
      playAgain.classList.add("button");
      playAgain.id = "playAgain";
      playAgain.innerHTML = "<span>Play Again</span>";
      playAgain.addEventListener("click", () => {
        window.location.reload();
      });
      buttonContainer.appendChild(playAgain);
    }

    await guessCountry();
    await guessState();
    await guessCity();
  }

  const startGame = (playButton) => {
    const playButtonContainer = playButton.currentTarget.parentNode;
    playButtonContainer.style.display = "none";
    main();
  };

  return (
    <div className="App">
      <div className="play-button-container">
        <div className="play-button" onClick={startGame}>
          <span>PLAY</span>
        </div>
      </div>
      <div className="App-content">
        <h2 id="Question">&nbsp;</h2>
        <div className="button-container" id="buttonContainer">
          <div className="button" id="yes">
            <span>YES</span>
          </div>
          <div className="button" id="no">
            <span>NO</span>
          </div>
        </div>
      </div>
      <div className="side-display menu-display">
        <h1 className="title">GeoDetective</h1>
        <p className="copyright">&copy; May 26th, 2023 Jasper Charlinski. All Rights Reserved.</p>
        <p>
          GeoDetective is a guessing game that asks a series of questions and
          pin points the city you are thinking of, on average GeoDetective takes
          30 guesses to get your city.
        </p>
        <div className="support-container">
          <h3>Support GeoDetective</h3>
          <label htmlFor="amount">
            {" "}
            Amount:
            <input
              type="number"
              className="amount-input"
              id="amount"
              step="0.50"
              min="0.50"
              placeholder="1.00"
            ></input>
          </label>

          <PayPalScriptProvider
            options={{
              "client-id":
                "AfyEnLHWdBngxJDMmot8XBQ6m685k9NaSWGCCpAMWhF2ADurOApSnKCQM4RNFoioW2l3FqsHjMTqu9rp",
              components: "buttons",
              currency: "CAD",
            }}
          >
            <PayPalButtons
              style={{ layout: "vertical" }}
              disabled={false}
              fundingSource={undefined}
              createOrder={(data, actions) => {
                let amount = document.getElementById("amount").value;
                let currency = "CAD";
                return actions.order
                  .create({
                    purchase_units: [
                      {
                        amount: {
                          currency_code: currency,
                          value: amount,
                        },
                      },
                    ],
                  })
                  .then((orderId) => {
                    // Your code here after create the order
                    return orderId;
                  });
              }}
              onApprove={function (data, actions, details) {
                return actions.order.capture().then(function () {
                  alert(
                    "Thank you for your donation " +
                      details.payer.name.given_name +
                      "!"
                  );
                });
              }}
            />
          </PayPalScriptProvider>
        </div>
      </div>
      <div className="side-display guess-display">
        <div className="side-display-item">
          <label htmlFor="currGuess">
            Current Guess:
            <span id="currGuess"></span>
          </label>
        </div>

        <div className="side-display-item">
          <label htmlFor="country"> Country </label>
          <div className="line"></div>
          <span id="country"></span>
        </div>

        <div className="side-display-item">
          <label htmlFor="state"> State </label>
          <div className="line"></div>
          <span id="state"></span>
        </div>

        <div className="side-display-item">
          <label htmlFor="city"> City</label>
          <div className="line"></div>
          <span id="city"></span>
        </div>
      </div>
      <MapContainer
        center={mapState.center}
        zoom={mapState.zoom}
        className="map"
        ref={mapRef}
      >
        <Marker position={mapState.center} icon={pin} />
        <TileLayer
          url="https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=9gV4uoonYDTEEV1ywP3r"
          attribution='<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
        />
      </MapContainer>
    </div>
  );
}

export default App;
