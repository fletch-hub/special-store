# What's going on here

This is a test site using the BigCommerce platform, with modifications to the default Cornerstone theme per instructions.

[Preview Link](https://erics-special-store.mybigcommerce.com/)

Code: 4m5j8qiauj

## Overview

Added buttons for adding all visble category items to the cart, removing all items from the cart, and associated alerts. Per the instructions, added a bonus banner at the top of the category page that shows customer info when they're logged in.

## Notes

#### Add All to Cart
- Items that require a user selection are skipped, and an error modal is shown with links to the affected items. 
    - Spent a little too much time trying and failing to adjust the default focus element on this modal. Left it as-is.
    - There's some logic that controls whether the word 'item' is shown as plural
    - The way the handlebars templates and the `addAllToCart` function in the `Category` class handles the opening `<li>` and closing `</ul>` tags is ugly, but it's getting the job done and I haven't found any scenarios where it'd break (knock on wood!)
