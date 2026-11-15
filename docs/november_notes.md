# November Notes — Production

## Grower Setup Guide

- Is this to be published on the site, or just for us?
- Step 1 – there is no Hub Membership yet.
- Step 4 – wholesale/retail split – there is no retail yet.
- Add re listings that the suggested day to reset is Sunday/Monday.
- Checklist: Membership says "Active paid subscription" but there is NO payment required.
- Also need a section on Commission Rate and what it covers.
- Region = City or Regional Council name.

### Pick Up

- Can we create a pick-up location that isn't your farm – i.e. a Hub pickup?
- But the transaction doesn't follow the Hub set-up (which doesn't exist yet).

### Storefront

- Maybe introduce a new pick-up option field in the case of Hubs & Collectives (when they are ready).

### Platform Fee = 7%

- Is this from a calculation or just an arbitrary figure?

### Order Name

- `ORD – SXXX – 2611061737 – K2`
- `Order – Buyer name CHAR(4) – YYMMDDhhmm - ?`
- Can the YYMMDD be reversed?
- What is the K2 in this example?

### Set up Membership message

- Take out "Choose Hub Membership or" so it just reads "Choose the free Grower Listing…." since there is no Hub Membership yet.
- Remove any other reference to Hub Membership throughout the site.

## Register Interest

- Admin shows Fat Magpie as yet to be approved, but as Admin I can't approve – "An account with this email already exists". Same with all the other Register Interest emails that aren't approved yet.
- Even though I'm not approved, I was able to set up my Membership (when in my own account).
- We need to make sure that:
  - As admin I can approve requests.
  - Requests can only get membership once they're approved.

## Order vs Harvest list

- In my account, I can see I have an order but for the correct date range, there is nothing on the harvest list. If there is a date for something to be fulfilled, it should appear on the Harvest list.

## ORDERS (can go through this when we speak)

### 1. Order on Prod Order Dashboard (ORD – SXXX – 2611061737 – K2)

a. I didn't receive an email, but the order is for me.
b. When ordered, did this have a fulfillment date? It's not on the order.
c. The buyer needs to fill in the fulfillment date, not the grower.
d. The buyer needs to fill in either Delivery or Pickup option.
e. Only the Harvest date is chosen by the Grower (to ensure the Fulfilment date is satisfied).
f. Item is Dahlia bunch.
g. Price is $21.75.

### 2. Order email received (ORD-LEAR-2611061520-FP)

a. No order visible on Prod Order dashboard.
b. Email received.
c. Dates filled.
d. Delivery method filled.
e. Item is Dahlia – Café au Lait 1 bunch.
f. Price is $3.00.
g. As the Admin I can see the order in full format but as the User I can see the order by line summary only.
h. Where to go to see the Order isn't obvious (just select …).
i. Also if I click on it twice, the second time, the Open PO message is mostly hidden.
j. Instead of 'Actions' (there is only one action) can we have 'see PO' or are we expecting other actions?
k. Is the User meant to be able to enter dates on the Order? At the moment they can't – or is it because I don't have membership. User MUST be able to select Harvest dates.
l. As Admin I entered 12 Nov to Harvest & 13 Nov to Fulfil (even though Buyer should have selected a fulfil date). No time could be entered.
m. I saved, went out of the page, went back in, but it wasn't saved – blank again.
n. In the User view of the same order, the order has fulfil by 12 Nov 9.15pm which doesn't correlate to the Admin view. Where did this date/time come from?

### How to View the Order – what I'd like (resolution to issues above)

- Can we make the way to view an order the same for Admin & User?
- Admin way is better – i.e. click on the order on the dashboard and see it in full.
- As the ADMIN when I selected grower & buyer dates, I couldn't change the time – defaults to the current time.

### When Ordering

- If the Buyer selects Deliver, they MUST select the fulfil date & time.
- If the Buyer selects Pick-Up they MUST select the date (even if there's only one option). They can only select from the times made available by the Grower set-up.

## Memberships

### Grower Membership

- Make Free Membership Option 1 as it's the only option for now.
- What does 'No Attendance' mean?
- 'Paid in Full' – did we decide how often? Is weekly or on every order better? Is it cheaper to bulk-payout weekly for example or on each fulfilment?

### Hub Membership

- Don't show any details (dot points) as it's not decided yet.
- Just say 'Coming Soon' & make it Option 2.

### Membership completion screen

- When completing the Membership, inform the definition of Region = City or Regional Council Name.

---

There's still a lot I haven't checked due to needing assistance (need more than one user) with functional tests, but hopefully the Trial will help.
