function buildLocationFilter(locationId) {
  if (!locationId) {
    return undefined;
  }

  return {
    must: [
      {
        key: "location_id",
        match: {
          value: locationId,
        },
      },
    ],
  };
}

module.exports = {
  buildLocationFilter,
};
