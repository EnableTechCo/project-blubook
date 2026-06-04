# Email Templates

This folder is the runtime source of truth for BluBook email HTML.

Current templates:

- `customer-onboarding-complete.html`
- `partner-invite.html`
- `admin-invite.html`

Template variables use `{{variable_name}}` placeholders.

Examples:

- `{{customer_name}}`
- `{{package_name}}`
- `{{invoice_number}}`
- `{{invite_link}}`
- `{{invited_name}}`

The dispatcher loads HTML from this folder at send time.
