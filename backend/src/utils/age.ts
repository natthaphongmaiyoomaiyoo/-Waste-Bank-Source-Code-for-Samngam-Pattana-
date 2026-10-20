// Whole-year age on a given reference date (birthday not yet reached = one less).
export function ageOn(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

// Whole calendar months elapsed from `startDate` to `referenceDate`
// (e.g. started on the 15th -> counts month +N only once the N-th month reaches
// the 15th). Never negative.
export function monthsSince(startDate: Date, referenceDate: Date): number {
  let months =
    (referenceDate.getFullYear() - startDate.getFullYear()) * 12 +
    (referenceDate.getMonth() - startDate.getMonth());
  if (referenceDate.getDate() < startDate.getDate()) months -= 1;
  return Math.max(months, 0);
}
