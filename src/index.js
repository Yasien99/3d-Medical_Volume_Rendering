import '@kitware/vtk.js/favicon';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import '@kitware/vtk.js/Rendering/Profiles/Glyph';

import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';

import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import vtkHttpDataSetReader from '@kitware/vtk.js/IO/Core/HttpDataSetReader';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps';

import vtkImageCroppingWidget from '@kitware/vtk.js/Widgets/Widgets3D/ImageCroppingWidget';
import vtkImageCropFilter from '@kitware/vtk.js/Filters/General/ImageCropFilter';
import vtkPiecewiseGaussianWidget from '@kitware/vtk.js/Interaction/Widgets/PiecewiseGaussianWidget';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';


import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';

document.getElementById('examples-menu').addEventListener('change', function () {
    const croppingControl = document.querySelector('#cropping-control');
    const isoControl = document.querySelector('#iso-control');
    const rayTransferenceControl = document.querySelector('#ray-transfer-function');
    const presetsControl = document.querySelector('#presets-menu');

    if (this.value == "RAY_CASTING"){
        isoControl.style.visibility = 'hidden';
        croppingControl.style.visibility = 'visible';
        rayTransferenceControl.style.visibility = 'visible';
        presetsControl.style.visibility = 'visible';
        renderChest();
    }
    if (this.value == "MARCHING_CUBES"){
        isoControl.style.visibility = 'visible';
        croppingControl.style.visibility = 'hidden';
        presetsControl.style.visibility = 'hidden';
        rayTransferenceControl.style.visibility = 'hidden';
        renderHead();
    }
});

document.getElementById('presets-menu').addEventListener('change', function () {
    presetColorMapName = this.value;
    lookupTable.applyColorMap(vtkColorMaps.getPresetByName(presetColorMapName));
    renderChest();
});

let presetColorMapName = "Cold and Hot"
const container = document.querySelector('#container');

// We use the wrapper here to abstract out manual RenderWindow/Renderer/OpenGLRenderWindow setup
const genericRenderWindow = vtkGenericRenderWindow.newInstance();
genericRenderWindow.setContainer(container);
genericRenderWindow.resize();

const renderer = genericRenderWindow.getRenderer();
const renderWindow = genericRenderWindow.getRenderWindow();


// --- Set up the volume actor ---

const chestActor = vtkVolume.newInstance();
const chestMapper = vtkVolumeMapper.newInstance();

// tell the actor which mapper to use
chestActor.setMapper(chestMapper);


// --- set up our color lookup table and opacity piecewise function
const globalDataRange = [0, 255];
const lookupTable = vtkColorTransferFunction.newInstance();
const piecewiseFun = vtkPiecewiseFunction.newInstance();

lookupTable.applyColorMap(vtkColorMaps.getPresetByName(presetColorMapName));
lookupTable.setMappingRange(0, 256);
lookupTable.updateRange();

// set up simple linear opacity function
for (let i = 0; i <= 8; i++) {
    piecewiseFun.addPoint(i * 32, i / 8);
}

// set the actor properties
chestActor.getProperty().setRGBTransferFunction(0, lookupTable);
chestActor.getProperty().setScalarOpacity(0, piecewiseFun);
chestActor.getProperty().setInterpolationTypeToFastLinear();

const chestReaderSource = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
const headReaderSource = vtkHttpDataSetReader.newInstance({ fetchGzip: true });
const headActor = vtkActor.newInstance()
const headMapper = vtkMapper.newInstance()
const marchingCube = vtkImageMarchingCubes.newInstance({
    contourValue: 0.0,
    computeNormals: true,
    mergePoints: true,
})

headActor.setMapper(headMapper)
headMapper.setInputConnection(marchingCube.getOutputPort())

function updateIsoValue(e) {
    const isoValue = Number(e.target.value)
    marchingCube.setContourValue(isoValue)
    renderWindow.render()
}

function initSliderEventListener(dataRange, firstIsoValue) {
    const slider = document.querySelector('.isoValue')
    slider.setAttribute('min', dataRange[0])
    slider.setAttribute('max', dataRange[1])
    slider.setAttribute('value', firstIsoValue)
    slider.addEventListener('input', updateIsoValue)

}

function initCroppingEventListeners(croppingWidget) {
    const elems = document.querySelectorAll('.flag');
    for (let i = 0; i < elems.length; i++) {
        elems[i].addEventListener('change', (e) => updateFlag(e, croppingWidget));
    }

    const buttons = document.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', widgetRegistration);
    }
}

marchingCube.setInputConnection(headReaderSource.getOutputPort())

async function renderHead() {
    try {
        renderer.removeAllViewProps();
        renderWindow.render();

        await headReaderSource.setUrl("https://kitware.github.io/vtk-js/data/volume/headsq.vti")
        await headReaderSource.loadData();

        const data = headReaderSource.getOutputData()
        const dataRange = data.getPointData().getScalars().getRange()
        const firstIsoValue = (dataRange[0] + dataRange[1]) / 3

        initSliderEventListener(dataRange, firstIsoValue);

        marchingCube.setContourValue(firstIsoValue)
        renderer.addActor(headActor)
        renderer
            .getActiveCamera()
            .set({ position: [1, 1, 0], viewUp: [0, 0, -1] })
        renderer.resetCamera()
        renderWindow.render()
    }
    catch (e) { console.log(e) }
}

const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

async function renderChest() {
    try {
        renderer.removeAllViewProps();
        genericRenderWindow.resize();
        renderWindow.render();

        await chestReaderSource.setUrl('https://kitware.github.io/vtk-js/data/volume/LIDC2.vti');
        await chestReaderSource.loadData();
        const imageData = chestReaderSource.getOutputData();
        const dataArray = imageData.getPointData().getScalars();
        const dataRange = dataArray.getRange();
        globalDataRange[0] = dataRange[0];
        globalDataRange[1] = dataRange[1];

        const croppingWidget = vtkImageCroppingWidget.newInstance();
        const cropFilter = vtkImageCropFilter.newInstance();
        const cropState = croppingWidget.getWidgetState().getCroppingPlanes();

        adjustableTransferFunctionWidget.setDataArray(dataArray.getData());
        adjustableTransferFunctionWidget.applyOpacity(piecewiseFun);

        adjustableTransferFunctionWidget.setColorTransferFunction(lookupTable);
        lookupTable.onModified(() => {
            adjustableTransferFunctionWidget.render();
            renderWindow.render();
        });

        cropFilter.setInputConnection(chestReaderSource.getOutputPort());
        chestMapper.setInputConnection(cropFilter.getOutputPort());

        cropState.onModified(() =>
            cropFilter.setCroppingPlanes(cropState.getPlanes())
        );

        initCroppingEventListeners(croppingWidget);
        widgetManager.addWidget(croppingWidget);
        renderer.addVolume(chestActor);

        // update lookup table mapping range based on input dataset
        const range = chestReaderSource.getOutputData().getPointData().getScalars().getRange();
        lookupTable.setMappingRange(...range);
        lookupTable.updateRange();

        // update crop widget and filter with image info
        const image = chestReaderSource.getOutputData();
        cropFilter.setCroppingPlanes(...image.getExtent());
        croppingWidget.copyImageDataDescription(image);

        // --- Enable interactive picking of widgets ---
        widgetManager.enablePicking();
        renderWindow.render();

        // --- Reset camera and render the scene ---
        renderer.resetCamera();
        genericRenderWindow.resize();
        renderWindow.render();
    }
    catch (e) { console.log(e) }
}

function updateFlag(e, croppingWidget) {
    console.log(croppingWidget)
    const value = !!e.target.checked;
    const name = e.currentTarget.dataset.name;
    croppingWidget.set({ [name]: value }); // can be called on either viewWidget or parentWidget
    widgetManager.enablePicking();
    renderWindow.render();
}


const adjustableTransferFunctionWidget = vtkPiecewiseGaussianWidget.newInstance({
    numberOfBins: 256,
    size: [400, 150],
});
adjustableTransferFunctionWidget.updateStyle({
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    histogramColor: 'rgba(100, 100, 100, 0.5)',
    strokeColor: 'rgb(0, 0, 0)',
    activeColor: 'rgb(255, 255, 255)',
    handleColor: 'rgb(50, 150, 50)',
    buttonDisableFillColor: 'rgba(255, 255, 255, 0.5)',
    buttonDisableStrokeColor: 'rgba(0, 0, 0, 0.5)',
    buttonStrokeColor: 'rgba(0, 0, 0, 1)',
    buttonFillColor: 'rgba(255, 255, 255, 1)',
    strokeWidth: 2,
    activeStrokeWidth: 3,
    buttonStrokeWidth: 1.5,
    handleWidth: 3,
    iconSize: 20, // Can be 0 if you want to remove buttons (dblClick for (+) / rightClick for (-))
    padding: 10,
});

// ----------------------------------------------------------------------------
// Default setting Piecewise function widget
// ----------------------------------------------------------------------------

adjustableTransferFunctionWidget.addGaussian(0.425, 0.5, 0.2, 0.3, 0.2);
adjustableTransferFunctionWidget.addGaussian(0.75, 1, 0.3, 0, 0);

const transferFunctionContainer = document.querySelector('#ray-transfer-function');
adjustableTransferFunctionWidget.setContainer(transferFunctionContainer);
adjustableTransferFunctionWidget.bindMouseListeners();
adjustableTransferFunctionWidget.setSize(450, 150);

adjustableTransferFunctionWidget.onAnimation((start) => {
    if (start) {
        renderWindow.getInteractor().requestAnimation(adjustableTransferFunctionWidget);
    } else {
        renderWindow.getInteractor().cancelAnimation(adjustableTransferFunctionWidget);
    }
});

adjustableTransferFunctionWidget.onOpacityChange(() => {
    adjustableTransferFunctionWidget.applyOpacity(piecewiseFun);
    if (!renderWindow.getInteractor().isAnimating()) {
        renderWindow.render();
    }
});

renderChest();