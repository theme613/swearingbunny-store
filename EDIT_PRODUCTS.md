# Edit your products

1. Start the website with `npm start` if it is not already running.
2. Open **http://localhost:3000/admin** on the same computer.
3. Select a product, change the fields, and click **Save product**.
4. Use **View store** to see your changes. An open store tab also refreshes its catalogue when you return to it.

You can add products, update descriptions and features, set prices, change images, hide an offering, delete it, and move it up or down in the catalogue. All ten original requested services are included.

- Leave **Price** blank to show “Request a quote.” Zero is a valid price.
- Use **Price note** for “per day,” “one-time setup,” or another billing description. Currency is set with `CURRENCY` in `.env`.
- Enter one feature per line.
- For images, put a file in `public/assets` and enter `assets/your-file.jpg`, or use an HTTPS image URL.
- With no image, the product uses its fallback Font Awesome icon, such as `fa-gamepad` or `fa-heart`.
- Turn off **Visible in the store** to hide a product while keeping it in the manager.
- A custom WhatsApp message is optional. Leaving it empty automatically includes the current product name.
- **Move up** and **Move down** save the order immediately. Save any field changes first.

## Saving and recovery

Products live in `data/products.json`. Saving uses an atomic file replacement. The previous version is copied to `data/products.json.bak` before every save. To recover it, copy the backup over `data/products.json` and refresh the page. A product change does not require a server restart.

Two tabs cannot silently overwrite each other's changes. If you see a conflict, reload the manager and apply your changes again.

The manager is deliberately available only through localhost on the computer running the server. It requires no separate account. Public visitors cannot change products; remote administration would require an authenticated admin service.

## Light and dark themes

Use the **Light mode / Dark mode** button at the top of the store or manager. The selection is remembered in the browser. The light theme uses a white background. Edit the shared color tokens in `public/theme.css` to customize either palette.
