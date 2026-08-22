export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone) {
  const phoneRegex = /^\+?[\d\s\-\(\)]{8,20}$/;
  return phoneRegex.test(phone);
}

export function validateName(name) {
  return name && name.trim().length >= 2 && name.trim().length <= 100;
}

export function validateDate(date) {
  if (!date) return false;
  const inputDate = new Date(date);
  const now = new Date();
  return inputDate >= now;
}

export function validateFlightNumber(flight) {
  if (!flight) return true; // Optional field
  const flightRegex = /^[A-Z]{2}\d{3,4}$/i;
  return flightRegex.test(flight.trim());
}

export function validateNumberPeople(people) {
  const num = parseInt(people, 10);
  return !isNaN(num) && num >= 1 && num <= 20;
}

export function validateNumberBags(bags) {
  const num = parseInt(bags, 10);
  return !isNaN(num) && num >= 0 && num <= 20;
}