/** Outcomes of the database's resolve_registrant() / register_attendee() checks. */
export type RegistrantOutcome =
  | "INVITED"
  | "NEW"
  | "NOT_INVITED"
  | "ALREADY_REGISTERED"
  | "DECLINED"
  | "AMBIGUOUS_NAME"
  | "DUPLICATE_EMAIL"
  | "NAME_REQUIRED"
  | "COMPANY_REQUIRED";

/** "write to x@y.com" when there is a contact email, otherwise "contact the organisers". */
export function writeTo(contactEmail: string) {
  return contactEmail ? `write to ${contactEmail}` : "contact the organisers";
}

/** What to tell the person, and which field the message belongs under. Never reveals anyone else's details. */
export function outcomeMessage(
  outcome: string,
  contactEmail: string,
): { field: "firstName" | "lastName" | "email" | "company"; message: string } | null {
  const write = writeTo(contactEmail);
  switch (outcome) {
    case "NOT_INVITED":
      return {
        field: "lastName",
        message: `We can't find this name on the invite list. Use the first and last name on your invitation, or ${write}.`,
      };
    case "AMBIGUOUS_NAME":
      return {
        field: "firstName",
        message: "More than one invited guest matches this name. Type your first name in full, as on your invitation.",
      };
    case "ALREADY_REGISTERED":
      return {
        field: "lastName",
        message: `This name is already registered. To change the registration, ${write}.`,
      };
    case "DECLINED":
      return {
        field: "lastName",
        message: `This registration was declined. If you think that's a mistake, ${write}.`,
      };
    case "DUPLICATE_EMAIL":
      return {
        field: "email",
        message: `This email is already registered. To change your registration, ${write}.`,
      };
    case "NAME_REQUIRED":
      return { field: "firstName", message: "Enter your first and last name." };
    case "COMPANY_REQUIRED":
      return { field: "company", message: "Enter your company or organisation." };
    default:
      return null;
  }
}
