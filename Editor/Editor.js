/// <reference path="../_reference.d.ts" />
/// <reference path="./PickPointRes.ts" />
/// <reference path="./PickPointOptions.ts" />
/// <reference path="./PlaneSelectToolbarController.ts" />
var Editor = /** @class */ (function () {
    function Editor(layout, container) {
        var self = this;
        self._layout = layout;
        self._container = container;
        $(self._container).mousedown(function (evt) {
            self.MouseDown(evt);
        });
        $(self._container).mouseup(function (evt) {
            self.MouseUp(evt);
        });
        $(self._container).mousemove(function (evt) {
            self.MouseMove(evt);
        });
    }
    Editor.prototype.MouseDown = function (evt) {
        var self = this;
        if (!self._defer) {
            return;
        }
        if (!self._mouseDownAction) {
            return;
        }
        self._mouseDownAction(evt);
    };
    Editor.prototype.MouseUp = function (evt) {
        var self = this;
        if (!self._defer) {
            return;
        }
        if (!self._mouseUpAction) {
            return;
        }
        self._mouseUpAction(evt);
    };
    Editor.prototype.MouseMove = function (evt) {
        var self = this;
        if (!self._defer) {
            return;
        }
        if (!self._mouseMoveAction) {
            return;
        }
        self._mouseMoveAction(evt);
    };
    Editor.prototype.Cancel = function () {
        var self = this;
        if (self._defer) {
            var curDef = self._defer;
            self._defer = null;
            curDef.reject();
        }
        self.Clear();
    };
    Editor.prototype.Clear = function () {
        var self = this;
        UIInteractive.Instance.SetMessage(null);
        UIInteractive.Instance.SetSideContent(null);
        if (self._lineToBase) {
            self._layout.Scene.remove(self._lineToBase);
            self._lineToBase = null;
        }
        if (self._snapVisualBox) {
            self._layout.Scene.remove(self._snapVisualBox);
            self._snapVisualBox = null;
        }
        self._mouseDownAction = null;
        self._mouseMoveAction = null;
        self._mouseUpAction = null;
    };
    Editor.prototype.PickPoint = function (options) {
        var self = this;
        var planeType = options.PlaneType;
        self._defer = $.Deferred();
        UIInteractive.Instance.SetMessage(options.Message);
        // Create plane select toolbar
        //
        $.get("/Content/GetView?src=Editor/PlaneSelectToolbar", function (data) {
            if (data === undefined) {
                return;
            }
            if (self._defer.state() != "pending") {
                // defer resolved or rejected
                return;
            }
            UIInteractive.Instance.SetSideContent(data, function (compileData) {
                var controller = angular.element(compileData).controller();
                controller.SetPlaneType(planeType);
                controller.PlaneTypeChanged.on(function (newPlane) {
                    // Update local variable
                    planeType = newPlane;
                });
            });
        });
        var mouseDownPoint = null;
        if (options.IsSnapEnabled) {
            self._snapVisualBox = self.CreateSnapVisualBox();
            self._snapVisualBox.visible = false;
        }
        // Mouse Down Handler
        //
        self._mouseDownAction = function (evt) {
            var mousePoint = new THREE.Vector2(evt.clientX, evt.clientY);
            mouseDownPoint = mousePoint;
            //if (evt.which == 3)
            //{
            //    // Abort at right mouse button
            //    self._defer.reject();
            //    self._defer = null;
            //}
        };
        // Mouse Move Handler
        //
        self._mouseMoveAction = function (evt) {
            var mousePoint = new THREE.Vector2(evt.clientX, evt.clientY);
            var outWorldPoint = self.GetWorldPoint(options, mousePoint, planeType);
            if (outWorldPoint == null) {
                return;
            }
            if (options.IsSnapEnabled) {
                // Try get snap point
                var snapPoint = self.GetSnapPoint(mousePoint, options.SnapTolerancePx);
                if (snapPoint) {
                    outWorldPoint = snapPoint;
                }
                else {
                    // Try get ray cast point
                    var rayCastPoint = self.GetRayCastPoint(mousePoint);
                    if (rayCastPoint) {
                        outWorldPoint = rayCastPoint;
                    }
                }
                self.UpdateSnapVisualBox(snapPoint);
            }
            if (options.MouseMove) {
                options.MouseMove(options, mousePoint, outWorldPoint);
            }
            if (options.BasePoint) {
                if (self._lineToBase) {
                    App.Layout.Scene.remove(self._lineToBase);
                    self._lineToBase = null;
                }
                var p1 = new THREE.Vector3(options.BasePoint.x, options.BasePoint.y, options.BasePoint.z);
                var p2 = new THREE.Vector3(outWorldPoint.x, outWorldPoint.y, outWorldPoint.z);
                self._lineToBase = self.CreateLine(p1, p2);
            }
        };
        // Mouse Up Handler
        //
        self._mouseUpAction = function (evt) {
            if (evt.which != 1) {
                // Only left button allowed
                return;
            }
            var mousePoint = new THREE.Vector2(evt.clientX, evt.clientY);
            var dist = mousePoint.distanceTo(mouseDownPoint);
            if (dist <= 1) {
                var outWorldPoint = self.GetWorldPoint(options, mousePoint, planeType);
                if (outWorldPoint == null) {
                    return;
                }
                if (options.IsSnapEnabled) {
                    var snapPoint = self.GetSnapPoint(mousePoint, options.SnapTolerancePx);
                    if (snapPoint) {
                        outWorldPoint = snapPoint;
                    }
                    else {
                        // Try get ray cast point
                        var rayCastPoint = self.GetRayCastPoint(mousePoint);
                        if (rayCastPoint) {
                            outWorldPoint = rayCastPoint;
                        }
                    }
                }
                var res = new PickPointRes(outWorldPoint, planeType);
                self.Clear();
                var curDef = self._defer;
                self._defer = null;
                curDef.resolve(res);
            }
        };
        // Attach to clear event
        self._defer.promise().fail(function () {
            self.Clear();
        });
        return self._defer.promise();
    };
    Editor.prototype.UpdateSnapVisualBox = function (snapPoint) {
        var self = this;
        if (!snapPoint) {
            self._snapVisualBox.visible = false;
            return;
        }
        self._snapVisualBox.visible = true;
        self._snapVisualBox.position.set(snapPoint.x, snapPoint.y, snapPoint.z);
        var distCameraToSnap = self._layout.Camera.position.distanceTo(snapPoint);
        var scaleCoeff = distCameraToSnap / 50;
        if (self._layout.Camera instanceof THREE.OrthographicCamera) {
            scaleCoeff *= 4;
        }
        self._snapVisualBox.scale.set(scaleCoeff, scaleCoeff, scaleCoeff);
    };
    Editor.prototype.GetSnapPoint = function (mousePoint, snapTolerancePx) {
        var self = this;
        var devicePnt = self._layout.ScreenToDevice(mousePoint);
        var rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(devicePnt, self._layout.Camera);
        // Get object under mouse
        //
        var ents = App.Layout.GetEntities(true);
        var intersections = rayCaster.intersectObjects(ents, false);
        if (intersections == null || intersections.length == 0) {
            return null;
        }
        // Construct box to find nodes
        var screenBox = new THREE.Box2(new THREE.Vector2(mousePoint.x - (snapTolerancePx / 2), mousePoint.y - (snapTolerancePx / 2)), new THREE.Vector2(mousePoint.x + (snapTolerancePx / 2), mousePoint.y + (snapTolerancePx / 2)));
        var outPoint = null;
        var minDist = 0;
        for (var idx in intersections) {
            var inter = intersections[idx];
            var obj = inter.object;
            var objData = GetObjectData(obj);
            if (objData == null) {
                continue;
            }
            if (objData.EntityType != EntityType.Mesh &&
                objData.EntityType != EntityType.BCTool) {
                continue;
            }
            var interPoint = inter.point;
            var outItems = new Array();
            self._layout.Selector.GetNodesByRect(screenBox, obj, outItems, false);
            if (outItems.length > 0) {
                for (var itemIdx in outItems) {
                    var item = outItems[itemIdx];
                    var vert = item.Vertex;
                    var dist = interPoint.distanceTo(vert);
                    if (outPoint == null || dist < minDist) {
                        outPoint = vert.clone();
                        minDist = dist;
                    }
                }
            }
        }
        return outPoint;
    };
    Editor.prototype.GetRayCastPoint = function (mousePoint) {
        var self = this;
        var devicePnt = self._layout.ScreenToDevice(mousePoint);
        var rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(devicePnt, self._layout.Camera);
        // Get object under mouse
        //
        var ents = App.Layout.GetEntities(true);
        var intersections = rayCaster.intersectObjects(ents, false);
        if (intersections == null || intersections.length == 0) {
            return null;
        }
        // Select point closest to camera
        var outPoint = null;
        var minDist = 0;
        var cameraPos = self._layout.Camera.position.clone();
        for (var idx in intersections) {
            var inter = intersections[idx];
            var obj = inter.object;
            var objData = GetObjectData(obj);
            if (objData == null) {
                continue;
            }
            if (objData.EntityType != EntityType.Mesh &&
                objData.EntityType != EntityType.BCTool) {
                continue;
            }
            var dist = cameraPos.distanceTo(inter.point);
            if (outPoint == null || dist < minDist) {
                outPoint = inter.point.clone();
                minDist = dist;
            }
        }
        return outPoint;
    };
    Editor.prototype.GetWorldPoint = function (options, mousePoint, planeType) {
        var self = this;
        var basePoint = options.BasePoint;
        if (!basePoint) {
            basePoint = new THREE.Vector3(0, 0, 0);
        }
        var plane;
        if (planeType == PlaneEditorType.XY) {
            var normal = new THREE.Vector3(0, 0, 1);
            var d = -basePoint.dot(normal);
            plane = new THREE.Plane(normal, d);
        }
        else if (planeType == PlaneEditorType.XZ) {
            var normal = new THREE.Vector3(0, 1, 0);
            var d = -basePoint.dot(normal);
            plane = new THREE.Plane(normal, d);
        }
        else if (planeType == PlaneEditorType.YZ) {
            var normal = new THREE.Vector3(1, 0, 0);
            var d = -basePoint.dot(normal);
            plane = new THREE.Plane(normal, d);
        }
        else {
            throw new Error("Unknown plane type");
        }
        var worldPoint = self._layout.ScreenToWorld(mousePoint);
        var camPos = self._layout.Camera.position.clone();
        var dir;
        if (self._layout.Camera instanceof THREE.PerspectiveCamera) {
            dir = worldPoint.clone().sub(camPos).normalize();
        }
        else if (self._layout.Camera instanceof THREE.OrthographicCamera) {
            // ortho
            dir = new THREE.Vector3(0, 0, -1);
            // Transforms the direction of this vector by a matrix (a 3 x 3 subset of a Matrix4) and then normalizes the result.
            dir.transformDirection(self._layout.Camera.matrixWorld);
        }
        var ray = new THREE.Ray(worldPoint, dir);
        var intersectionPoint = ray.intersectPlane(plane);
        if (intersectionPoint == null) {
            return null;
        }
        return intersectionPoint;
    };
    Editor.prototype.CreateLine = function (p1, p2) {
        var material = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 5,
            fog: false,
            depthTest: false
        });
        var geometry = new THREE.Geometry();
        geometry.vertices.push(p1, p2);
        var line = new THREE.Line(geometry, material);
        App.Layout.Scene.add(line);
        line.renderOrder = 2;
        return line;
    };
    Editor.prototype.CreateSnapVisualBox = function () {
        var map = THREE.ImageUtils.loadTexture("/Images/SnapRect.png");
        var snapBoxSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: map, color: 0xffffff, fog: true }));
        App.Layout.Scene.add(snapBoxSprite);
        return snapBoxSprite;
    };
    return Editor;
}());
