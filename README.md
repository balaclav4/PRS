# PRS Precision - Precision Rifle Shooting Analytics

A web application for precision rifle shooters to analyze their target groups with advanced image processing and statistical analysis.

## Features

- 📸 **Target Detection**: Automatically detect orange target circles in photos
- 🎯 **Shot Marking**: Click to mark shot holes with precise measurements
- 📊 **Group Analysis**: Calculate group size, mean radius, and standard deviation
- ⚡ **Chronograph Integration**: Import velocity data for load development
- 📈 **Statistical Comparison**: Compare loads, rifles, and sessions with t-tests
- 📱 **Mobile Optimized**: Works great on phones and tablets
- 💾 **Data Export**: Export all data to CSV for external analysis
- 🔫 **Equipment Tracking**: Manage rifles and load data

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Usage

1. **Upload Target Photo**: Take a clear photo of your targets with orange stickers
2. **Set Scale**: Enter the target diameter (e.g., 1.0 inches)
3. **Select Targets**: Click on the center of each orange target
4. **Mark Shots**: Click on each shot hole
5. **Review & Save**: Check your data and save the session
6. **Analyze**: View statistics and compare different loads/rifles

## iOS App Integration

The app includes API endpoints ready for iOS app development:
- `POST /api/sessions` - Save session data
- `GET /api/sessions` - Load all sessions
- `POST /api/equipment` - Save equipment
- `GET /api/equipment` - Load equipment
- `GET /api/export?format=csv` - Export data

## Technologies Used

- React 18
- Tailwind CSS
- Lucide React (icons)
- Canvas API for image processing

## License

MIT License

## Author

Created for precision rifle shooters who demand the best in data analysis.