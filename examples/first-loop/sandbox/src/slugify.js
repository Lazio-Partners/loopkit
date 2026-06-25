export function slugify(input) {
  return String(input).toLowerCase().replace(/\s+/g, "-");
}
