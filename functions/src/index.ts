import { logger, setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { Timestamp } from "firebase-admin/firestore";

export interface Data {
  get_new_data: boolean;
  sunrise: number;
  sunset: number;
  lat: number;
  lng: number;
  updated_at: Timestamp;
}

initializeApp();
setGlobalOptions({ region: "asia-east1", maxInstances: 10 });

exports.watchData = onDocumentUpdated("data/data", async (event) => {
  if (!event || !event.data) return;

  const oldReadingData = event.data.before.data() as Data;
  const newReadingData = event.data.after.data() as Data;

  if (!oldReadingData || !newReadingData) return;

  if (!newReadingData.get_new_data) return;

  logger.info(`Will Get Sunset Sunrise Data.`, {
    structuredData: true,
  });

  getSunsetSunriseData(
    newReadingData.lat,
    newReadingData.lng,
    event.data.after.ref
  );

  return;

  // logger.info(`newMosquitoDetectedState: ${newMosquitoDetectedState}`, {
  //   structuredData: true,
  // });
});

function getSunsetSunriseData(
  lat: number,
  lng: number,
  ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>
) {
  fetch(`https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}`)
    .then((response) => response.json())
    .then((data) => {
      const sunrise: string = data?.results?.sunrise;
      const sunset: string = data?.results?.sunset;
      logger.info(`Sunset Sunrise Data: ${data} - ${sunrise} ${sunset}`, {
        structuredData: true,
      });

      if (!sunrise || !sunset) return;

      // Update firestore
      ref
        .set(
          {
            get_new_data: false,
            sunrise: getTotalMinutes(sunrise),
            sunset: getTotalMinutes(sunset),
            updated_at: Timestamp.now(),
          },
          { merge: true }
        )
        .then(() => {
          logger.info(`Sunset Sunrise Data Updated`, {
            structuredData: true,
          });
        });
    });
}

function getTotalMinutes(timeString: string): number {
  // Parse the time string
  const [time, meridiem] = timeString.split(" ");
  const [hours, minutes, _] = time.split(":").map((part) => parseInt(part));

  // Convert hours to 24-hour format if needed
  let totalMinutes;
  if (meridiem === "AM" && hours === 12) {
    // Midnight
    totalMinutes = minutes;
  } else if (meridiem === "PM" && hours === 12) {
    // Noon
    totalMinutes = 12 * 60 + minutes;
  } else if (meridiem === "PM") {
    totalMinutes = (hours + 12) * 60 + minutes;
  } else {
    totalMinutes = hours * 60 + minutes;
  }

  return totalMinutes;
}
