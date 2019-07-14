const { db } = require('./dbManager')
const secret = 'youShallNotPass'
const crypto = require('crypto')

db.connect().then(async () => {
    const points = await db.find('points', {})
    for (const p of points) {
        await db.insertMany(
            'pointz',
            p.data.map(pt => ({
                vid: p.vid,
                longitude: pt.longitude,
                latitude: pt.latitude,
                hash: crypto
                    .createHmac('sha256', secret)
                    .update(JSON.stringify(pt))
                    .digest('hex'),
            })),
        )
    }
    console.log('finish')
})

// const rectangleGrid = require('temp-turf-rectangle-grid')
// const turf = require('@turf/turf')
// const util = require('util')
// var Decimal = require('decimal.js')
// util.inspect.defaultOptions.depth = null
// // var originalCoords = [
// //     [-84.539487, 38.072916],
// //     [-84.498816, 38.060791],
// //     [-84.472941, 38.022564],
// //     [-84.512283, 38.018918],
// // ]

// // // var polygon = turf.polygon([original_coords], { name: 'poly1' });
// // // var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
// // var features = turf.featureCollection([
// //     turf.point([-84.539487, 38.072916], { name: 'Location A' }),
// //     turf.point([-84.498816, 38.060791], { name: 'Location B' }),
// //     turf.point([-84.472941, 38.022564], { name: 'Location C' }),
// //     turf.point([-84.512283, 38.018918], { name: 'Location D' }),
// // ])

// // var poly = turf.polygon([[...originalCoords, [-84.539487, 38.072916]]])
// // var enveloped = turf.envelope(features)
// // var center = turf.centerOfMass(enveloped)
// // var bbox = turf.bbox(enveloped)
// // // var bbox = turf.square(bbox)
// // var pointsCount = 15
// // var precision = 8
// // var wline = turf.lineString([[bbox[0], bbox[1]], [bbox[2], bbox[1]]])
// // var hline = turf.lineString([[bbox[0], bbox[1]], [bbox[0], bbox[3]]])
// // var div = pointsCount % 2 === 0 ? pointsCount / 2 : (pointsCount - 1) / 2
// // var wlength = turf.length(wline)
// // var hlength = turf.length(hline)
// // // var squares = turf.squareGrid(bbox, length / div)

// // var cellWidth = wlength / div
// // var cellHeight = hlength / 2
// // console.log({ bbox, wlength, div, cellWidth, cellHeight })

// // var squares = rectangleGrid.default(bbox, cellWidth, cellHeight)
// // var centers = turf.featureCollection(squares.features.map(f => turf.centerOfMass(f)))
// // console.log(squares.features.length)
// // console.log(JSON.stringify(squares))
// // console.log('!!!!!!!!!!')
// // console.log(JSON.stringify(centers))

// const preparePoint = point => {
//     let newPoint = new Decimal(point.toString().replace(',', '.'))

//     return newPoint
//         .toFixed(8)
//         .toString()
//         .replace('.', '')
// }

// console.log(preparePoint('38.072916'))
// console.log(preparePoint('138.072916'))
// console.log(preparePoint('-138.072916'))
// console.log(preparePoint('-38.072916'))
// console.log(preparePoint('-3.072916'))
// console.log(preparePoint('-38,072916'))
// console.log(preparePoint('-138,072916'))
// console.log(preparePoint('-1,072916'))
// console.log(preparePoint('-1,07'))
// console.log(preparePoint('-1,0'))
// console.log(preparePoint(-38.072916))
// console.log(preparePoint(-138.072916))
// console.log(preparePoint(-1.072916))
// console.log(preparePoint(-1.07))
// console.log(preparePoint(-1.0))
